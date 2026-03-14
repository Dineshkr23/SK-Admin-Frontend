/**
 * Admin panel theme aligned with Mason&BarbenderForm.tsx (SK Super TMT).
 * Colors and input styles for consistency across login, table, and detail dialog.
 */

export const adminColors = {
  primary: '#d11b1b',
  primaryHover: '#b31818',
  background: '#f8fafc',
  backgroundCard: '#ffffff',
  border: '#d0d5dd',
  borderLight: '#d3d3d3',
  sectionHeaderYellow: 'linear-gradient(90deg, rgb(255, 230, 101) 0%, rgb(255, 224, 0) 100%);',
  text: '#1d2939',
  textBlack: '#000000',
  textSecondary: '#344054',
  textMuted: '#667085',
  placeholder: '#9ca3af',
  success: '#0f8a3c',
  error: '#b42318',
  shadow: '0 16px 40px rgba(16, 24, 40, 0.14)',
} as const;

/** Yellow section header bar: black bold uppercase text on yellow background */
export const adminSectionHeaderBarStyle = {
  background: adminColors.sectionHeaderYellow,
  color: adminColors.textBlack,
  padding: '10px 12px',
  marginBottom: 2,
  marginTop: 2,
  width: 'fit-content',
  minWidth: 250,
  borderRadius: 0.8,
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
};

/** Dialog form inputs: white background, light grey border, rounded (per screenshots) */
export const dialogInputSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'rgb(248, 250, 252)',
    padding: '3px',
    borderRadius: 0.8,
    '& fieldset': { borderColor: adminColors.borderLight },
    '&:hover fieldset': { borderColor: adminColors.border },
  },
};

export const adminFieldStyle = {
  width: '100%',
  minHeight: 46,
  border: `1px solid ${adminColors.border}`,
  borderRadius: 10,
  backgroundColor: adminColors.background,
  color: adminColors.text,
  padding: '10px 12px',
  fontSize: 14,
  boxSizing: 'border-box' as const,
  outline: 'none',
};

export const adminSectionStyle = (isMobile?: boolean) => ({
  maxWidth: 1040,
  margin: '0 auto',
  backgroundColor: adminColors.backgroundCard,
  borderRadius: isMobile ? 1 : 1,
  boxShadow: adminColors.shadow,
  padding: isMobile ? '18px 14px 26px' : '30px 28px 34px',
  border: `1px solid ${adminColors.borderLight}`,
});

export const adminPrimaryButtonStyle = {
  border: 'none',
  backgroundColor: adminColors.primary,
  color: '#ffffff',
  padding: '10px 24px',
  fontWeight: 700,
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 14,
};

export const adminSecondaryButtonStyle = {
  border: `1px solid ${adminColors.border}`,
  backgroundColor: adminColors.background,
  color: adminColors.text,
  padding: '10px 24px',
  fontWeight: 600,
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 14,
};

export const adminSectionTitleStyle = {
  margin: '0 0 10px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: adminColors.textSecondary,
};

/** Upload card in dialog: white background, rounded, label + subtitle + thumbnail + X + accepted types */
export const adminDialogUploadCardStyle = {
  backgroundColor: adminColors.backgroundCard,
  borderRadius: 12,
  padding: 16,
  border: `1px solid ${adminColors.borderLight}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

export const adminGridTwo = {
  display: 'grid' as const,
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 2,
  marginBottom: 2,
};

export const adminCheckboxLineStyle = {
  display: 'flex' as const,
  alignItems: 'center',
  gap: 10,
  fontSize: 14,
  color: adminColors.text,
};

export const adminUploadCardStyle = {
  backgroundColor: '#f9fafb',
  borderRadius: 12,
  padding: 16,
  border: `1px solid ${adminColors.borderLight}`,
};
