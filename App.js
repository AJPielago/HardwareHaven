import React from 'react';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, StyleSheet, View } from 'react-native';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { paperTheme, brand } from './src/theme/brandTheme';

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <Provider store={store}>
        <PaperProvider theme={paperTheme}>
          <StatusBar style="light" backgroundColor={brand.colors.navy} />
          <AppNavigator />
        </PaperProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '100vh',
      maxHeight: '100vh',
      width: '100%',
      maxWidth: '100%',
      display: 'flex',
      flexDirection: 'column',
    }),
  },
});
