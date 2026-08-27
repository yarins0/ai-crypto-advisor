import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter } from 'react-router';

import { createQueryClient } from '../lib/query-client.js';
import { AppRoutes } from './routes.js';

export function App() {
  // Lazy initial state, not a call in the render body: rebuilding the client on
  // a re-render would discard every cached query, including the session.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
