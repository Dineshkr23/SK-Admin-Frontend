"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#d11b1b",
      dark: "#b31818",
    },
    secondary: {
      main: "#344054",
    },
    background: {
      default: "#f8fafc",
      paper: "#ffffff",
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "#f8fafc",
            borderRadius: 10,
            "& fieldset": { borderColor: "#d0d5dd" },
            "&:hover fieldset": { borderColor: "#667085" },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          backgroundColor: "#d11b1b",
          padding: "10px 16px",
          borderRadius: 7,
          fontWeight: 700,
          "&:hover": { backgroundColor: "#b31818" },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: "1px solid #eaecf0",
          boxShadow: "0 16px 40px rgba(16, 24, 40, 0.14)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        colorPrimary: {
          backgroundColor: "#d11b1b",
          color: "#fff",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        colorPrimary: {
          background:
            "linear-gradient(90deg, rgb(255, 230, 101) 0%, rgb(255, 224, 0) 100%);",
          color: "#000",
          border: "none",
          boxShadow: "none",
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: "1px solid #eaecf0",
          borderRadius: 10,
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: "rgb(248, 250, 252)",
            borderBottom: "1px solid #d0d5dd",
          },
          "& .MuiDataGrid-cell": {
            borderColor: "#eaecf0",
          },
        },
      },
    },
  },
});

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
