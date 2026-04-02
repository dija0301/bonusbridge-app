import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tlyvvuqnambojiiagrvt.supabase.co'
const supabaseAnonKey = 'sb_publishable_wmKtnr0QsTzrmig4byhqhQ_zTtUaUrw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
