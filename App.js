import { registerRootComponent } from 'expo';
import React from 'react';
import { View, Text } from 'react-native';

function TestApp() {
  console.log('>>> ROOT CompFit/App.js is being used <<<');
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'lightblue' }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>ROOT CompFit/App.js</Text>
      <Text>Blue = App.js is entry point</Text>
    </View>
  );
}

registerRootComponent(TestApp);