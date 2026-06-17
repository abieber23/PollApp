import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly platformId = inject(PLATFORM_ID);
  private _client: SupabaseClient | null = null;

  get client(): SupabaseClient {
    if (!this._client) {
      if (!isPlatformBrowser(this.platformId)) {
        throw new Error('Supabase client is only available in the browser');
      }
      this._client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
    }
    return this._client;
  }

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
