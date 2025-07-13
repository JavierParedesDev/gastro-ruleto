import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface ProfilePictureProps {
  photoURL?: string | null;
  frameURL?: string | null;
  size?: number;
  borderColor?: string;
  borderWidth?: number;
}

const ProfilePicture = ({
  photoURL,
  frameURL,
  size = 50,
  borderColor = '#fff',
  borderWidth = 2,
}: ProfilePictureProps) => {
  const styles = StyleSheet.create({
    container: {
      width: size,
      height: size,
      justifyContent: 'center',
      alignItems: 'center',
    },
    photo: {
      width: '100%',
      height: '100%',
      borderRadius: size / 2,
      borderColor: borderColor,
      borderWidth: borderWidth,
    },
    frame: {
      position: 'absolute',
      width: size * 1.15, // El marco es un poco más grande que la foto
      height: size * 1.15,
      resizeMode: 'contain',
    },
  });

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: photoURL || 'https://placehold.co/150x150/FFDDC9/FF5C00?text=Foto' }}
        style={styles.photo}
      />
      {frameURL && <Image source={{ uri: frameURL }} style={styles.frame} />}
    </View>
  );
};

export default ProfilePicture;
