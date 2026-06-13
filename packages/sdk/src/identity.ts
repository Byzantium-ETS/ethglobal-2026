// Identity module stub: ENS helper functions
// TODO: implement ENS subname registration and text-record writer using @ensdomains/ensjs

export async function registerSubname(parent: string, name: string, owner: string): Promise<string> {
  // placeholder return value: subname
  return `${name}.${parent}`;
}

export async function readTextRecords(name: string): Promise<Record<string, string>> {
  return {
    description: 'placeholder',
    'io.agentgate.x402-endpoint': 'https://example.com/call'
  };
}
