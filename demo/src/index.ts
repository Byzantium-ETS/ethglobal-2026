import { discoverAgents, PaymentsClient, requestWorldProof, type AgentMetadata } from '@agentgate/sdk';

type JsonResponse<T = unknown> = {
	status: number;
	body: T;
	text: string;
};

function env(name: string): string | undefined {
	const value = process.env[name];
	return value && value.trim() !== '' ? value.trim() : undefined;
}

function normalizedPrivateKey(value: string): `0x${string}` {
	return (value.startsWith('0x') ? value : `0x${value}`) as `0x${string}`;
}

async function readJson<T = unknown>(response: Response): Promise<JsonResponse<T>> {
	const text = await response.text();
	return {
		status: response.status,
		body: text ? JSON.parse(text) as T : null as T,
		text,
	};
}

async function checkProvider(providerUrl: string): Promise<void> {
	const rootUrl = new URL('/', providerUrl).toString();
	const response = await readJson(await fetch(rootUrl));
	console.log(`[demo] provider ${rootUrl} -> ${response.status}`);
	console.log(response.body);
}

async function discoverProvider(providerUrl: string): Promise<AgentMetadata> {
	const ensParent = env('ENS_PARENT');
	const rpcUrl = env('RPC_URL');

	if (env('RUN_DEMO_DISCOVERY') === 'true' && ensParent && rpcUrl) {
		const agents = await discoverAgents(ensParent, { rpcUrl });
		const selected = agents.find((agent) => agent.x402Endpoint) ?? agents[0];
		if (selected) {
			console.log(`[demo] discovered ${agents.length} ENS agent(s); selected ${selected.name}`);
			return selected;
		}
	}

	console.log('[demo] ENS discovery skipped; using provider URL from env/default');
	return {
		name: env('DEMO_AGENT_NAME') ?? 'local.agentgate.eth',
		description: 'Local AgentGate provider',
		capabilities: ['demo', 'phase-3'],
		x402Endpoint: providerUrl,
		x402Price: env('DEMO_X402_PRICE') ?? '0.001',
		worldVerified: false,
		records: {},
	};
}

async function runFreeCalls(callUrl: string): Promise<void> {
	const configuredHeader = env('DEMO_AGENTKIT_HEADER') ?? env('AGENTKIT_HEADER');
	const shouldRunFreeCalls = configuredHeader || env('RUN_DEMO_FREE_CALLS') === 'true';
	const attempts = Number(env('DEMO_FREE_CALLS') ?? '2');
	const statement = env('DEMO_AGENTKIT_STATEMENT') ?? 'AgentGate demo free call';

	if (!shouldRunFreeCalls) {
		console.log('[demo] free calls skipped: set RUN_DEMO_FREE_CALLS=true to generate AgentKit headers with the SDK');
		return;
	}

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		const proof = configuredHeader ? { success: true, proof: configuredHeader } : await requestWorldProof(callUrl, statement);
		if (!proof.success || !proof.proof) {
			throw new Error('[demo] failed to generate AgentKit header for free call');
		}

		const response = await readJson(await fetch(callUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				agentkit: proof.proof,
			},
			body: JSON.stringify({ prompt: `free demo call ${attempt}` }),
		}));
		console.log(`[demo] free call ${attempt} -> ${response.status}`);
		console.log(response.body);
	}
}

async function runPaidCall(callUrl: string): Promise<void> {
	const privateKey = env('BUYER_PRIVATE_KEY') ?? env('DEMO_PRIVATE_KEY');
	const arcRpcUrl = env('ARC_RPC_URL');

	if (env('RUN_DEMO_PAID_CALL') !== 'true') {
		const unpaid = await readJson(await fetch(callUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ prompt: 'unpaid demo probe' }),
		}));
		console.log(`[demo] unpaid probe -> ${unpaid.status}`);
		console.log(unpaid.body);
		console.log('[demo] paid call skipped: set RUN_DEMO_PAID_CALL=true with BUYER_PRIVATE_KEY and ARC_RPC_URL');
		return;
	}

	if (!privateKey || !arcRpcUrl) {
		throw new Error('[demo] RUN_DEMO_PAID_CALL=true requires BUYER_PRIVATE_KEY or DEMO_PRIVATE_KEY plus ARC_RPC_URL');
	}

	const client = new PaymentsClient({
		privateKey: normalizedPrivateKey(privateKey),
		rpcUrl: arcRpcUrl,
	});
	const response = await client.pay(callUrl, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ prompt: 'paid demo call' }),
	});
	const paid = await readJson(response);
	console.log(`[demo] paid call -> ${paid.status}`);
	console.log(paid.body);
}

async function main(): Promise<void> {
	const providerUrl = env('AGENTGATE_PROVIDER_URL') ?? 'http://127.0.0.1:3000/call';

	console.log('[demo] AgentGate Phase 3 runner');
	await checkProvider(providerUrl);

	const provider = await discoverProvider(providerUrl);
	const callUrl = provider.x402Endpoint ?? providerUrl;
	console.log(`[demo] call endpoint ${callUrl}`);

	await runFreeCalls(callUrl);
	await runPaidCall(callUrl);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
