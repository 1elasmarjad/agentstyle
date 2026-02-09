export interface Provider {
  id: string;
  run(prompt: string): Promise<string>;
}

