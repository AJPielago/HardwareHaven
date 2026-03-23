import React from 'react';
import { Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import SocialLoginScreen from '../screens/auth/SocialLoginScreen';
import LandingScreen from '../screens/auth/LandingScreen';

const Stack = createStackNavigator();

export default function AuthNavigator() {
  const isWeb = Platform.OS === 'web';
  
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName={isWeb ? 'Landing' : 'Login'}
    >
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="SocialLogin" component={SocialLoginScreen} />
    </Stack.Navigator>
  );
}
