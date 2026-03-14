"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { AppBar, Toolbar, Button, Box } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";

export default function SubmissionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token && pathname?.startsWith("/submissions")) {
      router.replace("/login");
    }
  }, [router, pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
    router.refresh();
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <AppBar position="static">
        <Toolbar>
          <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
            <Image
              src="/SK-SUPER-TMT-logo.webp"
              alt="SK Super TMT Admin"
              width={200}
              height={60}
              style={{ height: 60, width: "auto", objectFit: "contain" }}
              priority
            />
          </Box>
          <Button
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            sx={{
              backgroundColor: "#000",
              color: "#fff",
              "&:hover": {
                backgroundColor: "#fff",
                color: "#000",
              },
            }}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          p: 2,
          overflow: "hidden",
          backgroundColor: "#fff",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
