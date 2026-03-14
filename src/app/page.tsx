'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Skeleton, Stack } from '@mui/material';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      router.replace('/submissions');
    } else {
      router.replace('/login');
    }
  }, [router]);
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Stack direction="column" spacing={2} sx={{ width: '100%', maxWidth: 320 }}>
        <Skeleton variant="text" width="60%" sx={{ mx: 'auto' }} />
        <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2 }} />
      </Stack>
    </Box>
  );
}
