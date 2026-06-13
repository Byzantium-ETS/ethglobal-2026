// Trust module stub: World AgentKit helper functions
// TODO: integrate with @worldcoin/agentkit to request proof and register agents

export async function requestWorldProof(): Promise<{ success: boolean; proof?: string }> {
  return { success: false };
}

export async function registerAgentWallet(address: string): Promise<boolean> {
  // placeholder
  return true;
}
