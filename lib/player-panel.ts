export function playerPanel(dark: boolean) {
  return {
    surface: dark ? '#271d27' : '#fff9fc',
    border: dark ? '#5c4554' : '#e4d2dd',
    text: dark ? '#fff7fa' : '#2b2028',
    muted: dark ? '#d9c5d1' : '#655561',
    accent: dark ? '#ff9ab4' : '#aa204d',
    selected: dark ? '#402b39' : '#f4e6ee',
  };
}

export const playerPanelFrame = {
  borderRadius: 18,
  borderWidth: 1,
  shadowColor: '#1c0b16',
  shadowOpacity: 0.24,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
} as const;
