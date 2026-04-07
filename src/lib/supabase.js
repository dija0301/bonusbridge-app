import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tlyvvuqnambojiiagrvt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRseXZ2dXFuYW1ib2ppaWFncnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTQzMzQsImV4cCI6MjA5MDYzMDMzNH0.FvjwOOw948G0u3T7iEVhNFKwr-yvuYxV1V-HQ6OrUZQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
