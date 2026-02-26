export const formatJobType = (jenis: string): string => {
  if (!jenis) return '';
  if (jenis === 'Register') return 'Registrasi';
  if (jenis === 'Pencopotan Steples') return 'Pencopotan Staples';
  return jenis;
};
