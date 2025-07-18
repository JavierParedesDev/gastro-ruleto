const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Función para enviar una notificación cuando se crea un nuevo documento en la colección 'notifications'
exports.sendNotificationOnNewFollow = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snap, context) => {
    const notificationData = snap.data();
    const userId = notificationData.userId;

    // Obtener el token de notificación del usuario
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.log(`No se encontró al usuario con ID: ${userId}`);
      return;
    }
    const userData = userDoc.data();
    const pushToken = userData.pushToken;

    if (pushToken) {
      const message = {
        to: pushToken,
        sound: "default",
        title: "Nueva Notificación",
        body: notificationData.message,
        data: { someData: "goes here" },
      };

      try {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        });
      } catch (error) {
        console.error("Error al enviar la notificación push:", error);
      }
    }
  });

// Función programada para enviar sugerencias de comida (ejecutar todos los días a las 9 AM)
exports.sendDailySuggestion = functions.pubsub.schedule('every day 09:00')
  .timeZone('America/Santiago')
  .onRun(async (context) => {
    const usersSnapshot = await admin.firestore().collection("users").where("pushToken", "!=", null).get();
    
    if (usersSnapshot.empty) {
        console.log("No hay usuarios con tokens para notificar.");
        return null;
    }

    const messages = [];
    usersSnapshot.forEach(doc => {
        const user = doc.data();
        if (user.pushToken) {
            messages.push({
                to: user.pushToken,
                sound: "default",
                title: "Sugerencia del Día 🍲",
                body: `¡Hola ${user.name}! Tu sugerencia de comida para hoy está lista. ¡Échale un vistazo!`,
            });
        }
    });

    // Envía las notificaciones en lotes
    for (const message of messages) {
        try {
            await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(message),
            });
        } catch (error) {
            console.error("Error enviando notificación a", message.to, error);
        }
    }

    return null;
});
