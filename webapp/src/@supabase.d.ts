// Type stub for @supabase/supabase-js used by OSPREY-app
declare module '@supabase/supabase-js' {
  export interface Session {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type: string;
    type: string;
    user: any;
  }

  export interface SupabaseClient {
    auth: any;
    from(table: string): any;
    functions: {
      invoke<T = any>(name: string, options?: any): Promise<{ data: T | null; error: any }>;
    };
  }

  export function createClient(url: string, key: string, options?: any): SupabaseClient;
}

declare module 'react-native-url-polyfill/auto' {
  // empty stub
}
