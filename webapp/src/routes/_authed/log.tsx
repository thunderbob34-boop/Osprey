import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/_authed/log')({ component: () => <h1>Log</h1> });
