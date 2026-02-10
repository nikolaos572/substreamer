import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { fetchServerInfo, login as subsonicLogin } from '../services/subsonicService';
import { authStore } from '../store/authStore';
import { serverInfoStore } from '../store/serverInfoStore';

export function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const isLoggedIn = authStore((s) => s.isLoggedIn);
  const setSession = authStore((s) => s.setSession);

  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isLoggedIn) {
    return <Redirect href="/" />;
  }

  const handleSubmit = async () => {
    const url = serverUrl.trim();
    const user = username.trim();
    const pass = password;

    if (!url || !user || !pass) {
      setError('Please fill in all fields.');
      return;
    }
    setError(null);
    setLoading(true);

    const result = await subsonicLogin(url, user, pass);
    setLoading(false);

    if (result.success) {
      setSession(url, user, pass, result.version);
      const info = await fetchServerInfo();
      if (info) serverInfoStore.getState().setServerInfo(info);
      router.replace('/');
    } else {
      setError(result.error || 'Invalid server or credentials.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Substreamer</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Sign in to your Subsonic server
        </Text>

        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBg, color: colors.textPrimary },
          ]}
          placeholder="Server address (e.g. https://demo.navidrome.org)"
          placeholderTextColor={colors.textSecondary}
          value={serverUrl}
          onChangeText={(t) => {
            setServerUrl(t);
            setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!loading}
        />
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBg, color: colors.textPrimary },
          ]}
          placeholder="Username"
          placeholderTextColor={colors.textSecondary}
          value={username}
          onChangeText={(t) => {
            setUsername(t);
            setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBg, color: colors.textPrimary },
          ]}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
          secureTextEntry
          editable={!loading}
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />

        {error ? (
          <Text style={[styles.error, { color: colors.red }]}>{error}</Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary },
            loading && styles.buttonDisabled,
            pressed && !loading && styles.buttonPressed,
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Log in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  inner: {
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
