// Généré par scripts/rebuild/gen_meta.py — ne pas éditer à la main.
// Structure de la base reconstruite : ordre de restauration (une table après
// celles qu'elle référence), clés primaires, colonnes calculées.

export const RESTORE_ORDER = [
  "accounting_accounts",
  "accounting_entries",
  "accounting_periods",
  "accounting_rules",
  "accounting_settings",
  "accounting_vat_filings",
  "ad_stats",
  "agent_config",
  "agent_config_history",
  "agent_config_pending_changes",
  "analytics_daily_snapshots",
  "bank_accounts",
  "bank_transactions",
  "blocked_dates",
  "leads",
  "customers",
  "bookings",
  "events_public",
  "expenses",
  "revenues",
  "cash_movements",
  "legacy_clients",
  "client_outreach",
  "content_marketing",
  "conversations",
  "email_log",
  "email_threads",
  "email_unsubscribes",
  "event_bookings",
  "financial_snapshots",
  "goals",
  "hub_workspaces",
  "hub_agents",
  "hub_channel_connections",
  "hub_contacts",
  "hub_conversations",
  "hub_agent_activities",
  "hub_agent_channels",
  "hub_credit_ledger",
  "hub_messages",
  "hub_settings",
  "profiles",
  "prospects",
  "qonto_sync_state",
  "recaps",
  "referrals",
  "seo_audits",
  "site_pageviews",
  "sumup_payouts",
  "sumup_sync_state",
  "sumup_transactions",
  "telegram_manager_conversations",
  "transactions",
  "wa_auth_state",
  "wa_conversations",
  "wa_inbox",
  "wa_lid_map",
  "wa_messages",
  "weather_cache"
] as const;

/** Clé primaire de chaque table (pour l'upsert). */
export const PRIMARY_KEYS: Record<string, string[]> = {
  "accounting_accounts": [
    "code"
  ],
  "accounting_entries": [
    "id"
  ],
  "accounting_periods": [
    "month"
  ],
  "accounting_rules": [
    "id"
  ],
  "accounting_settings": [
    "id"
  ],
  "accounting_vat_filings": [
    "id"
  ],
  "ad_stats": [
    "id"
  ],
  "agent_config": [
    "id"
  ],
  "agent_config_history": [
    "id"
  ],
  "agent_config_pending_changes": [
    "id"
  ],
  "analytics_daily_snapshots": [
    "id"
  ],
  "bank_accounts": [
    "id"
  ],
  "bank_transactions": [
    "id"
  ],
  "blocked_dates": [
    "id"
  ],
  "leads": [
    "id"
  ],
  "customers": [
    "id"
  ],
  "bookings": [
    "id"
  ],
  "events_public": [
    "id"
  ],
  "expenses": [
    "id"
  ],
  "revenues": [
    "id"
  ],
  "cash_movements": [
    "id"
  ],
  "legacy_clients": [
    "id"
  ],
  "client_outreach": [
    "id"
  ],
  "content_marketing": [
    "id"
  ],
  "conversations": [
    "id"
  ],
  "email_log": [
    "id"
  ],
  "email_threads": [
    "id"
  ],
  "email_unsubscribes": [
    "email"
  ],
  "event_bookings": [
    "id"
  ],
  "financial_snapshots": [
    "id"
  ],
  "goals": [
    "id"
  ],
  "hub_workspaces": [
    "id"
  ],
  "hub_agents": [
    "id"
  ],
  "hub_channel_connections": [
    "id"
  ],
  "hub_contacts": [
    "id"
  ],
  "hub_conversations": [
    "id"
  ],
  "hub_agent_activities": [
    "id"
  ],
  "hub_agent_channels": [
    "agent_id",
    "channel_connection_id"
  ],
  "hub_credit_ledger": [
    "id"
  ],
  "hub_messages": [
    "id"
  ],
  "hub_settings": [
    "id"
  ],
  "profiles": [
    "id"
  ],
  "prospects": [
    "id"
  ],
  "qonto_sync_state": [
    "id"
  ],
  "recaps": [
    "id"
  ],
  "referrals": [
    "id"
  ],
  "seo_audits": [
    "id"
  ],
  "site_pageviews": [
    "id"
  ],
  "sumup_payouts": [
    "id"
  ],
  "sumup_sync_state": [
    "id"
  ],
  "sumup_transactions": [
    "id"
  ],
  "telegram_manager_conversations": [
    "id"
  ],
  "transactions": [
    "id"
  ],
  "wa_auth_state": [
    "id"
  ],
  "wa_conversations": [
    "id"
  ],
  "wa_inbox": [
    "id"
  ],
  "wa_lid_map": [
    "lid"
  ],
  "wa_messages": [
    "id"
  ],
  "weather_cache": [
    "id"
  ]
};

/** Colonnes calculées par la base : jamais envoyées à l'insertion. */
export const GENERATED_COLUMNS: Record<string, string[]> = {
  "bookings": [
    "net_margin"
  ]
};

/** Clés étrangères vers la même table : posées en second passage. */
export const SELF_REFERENCES: Record<string, string[]> = {
  "customers": [
    "referred_by"
  ]
};
