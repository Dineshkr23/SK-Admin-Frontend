"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, TextField, Typography, Alert } from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import { login } from "@/lib/api";
import { adminSectionStyle, adminColors } from "@/styles/adminTheme";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await login(email, password);
      if (typeof window !== "undefined") {
        localStorage.setItem("token", access_token);
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: adminColors.background,
        p: 2,
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          ...adminSectionStyle(false),
          maxWidth: 420,
          width: "100%",
        }}
      >
        <Typography
          variant="h5"
          component="h1"
          gutterBottom
          align="center"
          sx={{ color: adminColors.text, fontWeight: 700, mb: 2 }}
        >
          Admin Login
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          margin="normal"
          autoComplete="email"
          sx={{ mb: 1 }}
        />
        <TextField
          fullWidth
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          margin="normal"
          autoComplete="current-password"
          sx={{ mb: 2 }}
        />
        <LoadingButton
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          loading={loading}
          disabled={loading}
          sx={{
            mt: 2,
            py: 1.5,
            fontWeight: 700,
            borderRadius: 2,
          }}
        >
          Sign in
        </LoadingButton>
      </Box>
    </Box>
  );
}
