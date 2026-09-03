interface Window {
  khameleon: {
    runCommand(text: string): Promise<{ message: string }>;
  };
}
