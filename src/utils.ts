export function getPort({ defaultPort }: { defaultPort: number }) {
	const envPort = parseInt(process.env.PORT || '');
	if (envPort || envPort === 0) {
		return envPort;
	}
	else {
		return defaultPort;
	}
}
