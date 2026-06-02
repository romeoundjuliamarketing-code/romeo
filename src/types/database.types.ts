export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          age_years: number | null
          avatar_url: string | null
          created_at: string
          credits: number
          disciplines: string[]
          email: string | null
          gender: string | null
          height_cm: number | null
          id: string
          is_coach: boolean
          last_training_date: string | null
          membership_type: string
          name: string | null
          onboarding_completed: boolean
          show_fitness_in_group: boolean
          show_points_in_group: boolean
          show_weight_in_group: boolean
          streak_days: number
          arm_span_cm: number | null
          stance: 'orthodox' | 'southpaw' | null
          is_professional: boolean | null
          studio_id: string | null
          total_points: number
          training_frequency: string | null
          training_since: string | null
          expo_push_token: string | null
          show_fight_record: boolean
          show_stats: boolean
          profile_code: string
        }
        Insert: {
          age_years?: number | null
          avatar_url?: string | null
          created_at?: string
          credits?: number
          disciplines?: string[]
          email?: string | null
          gender?: string | null
          height_cm?: number | null
          id: string
          is_coach?: boolean
          last_training_date?: string | null
          membership_type?: string
          name?: string | null
          onboarding_completed?: boolean
          show_fitness_in_group?: boolean
          show_points_in_group?: boolean
          show_weight_in_group?: boolean
          streak_days?: number
          arm_span_cm?: number | null
          stance?: 'orthodox' | 'southpaw' | null
          is_professional?: boolean | null
          studio_id?: string | null
          total_points?: number
          training_frequency?: string | null
          training_since?: string | null
          expo_push_token?: string | null
          show_fight_record?: boolean
          show_stats?: boolean
          profile_code?: string
        }
        Update: {
          age_years?: number | null
          avatar_url?: string | null
          created_at?: string
          credits?: number
          disciplines?: string[]
          email?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          is_coach?: boolean
          last_training_date?: string | null
          membership_type?: string
          name?: string | null
          onboarding_completed?: boolean
          show_fitness_in_group?: boolean
          show_points_in_group?: boolean
          show_weight_in_group?: boolean
          streak_days?: number
          arm_span_cm?: number | null
          stance?: 'orthodox' | 'southpaw' | null
          is_professional?: boolean | null
          studio_id?: string | null
          total_points?: number
          training_frequency?: string | null
          training_since?: string | null
          expo_push_token?: string | null
          show_fight_record?: boolean
          show_stats?: boolean
          profile_code?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_studio_id_fkey'
            columns: ['studio_id']
            isOneToOne: false
            referencedRelation: 'studios'
            referencedColumns: ['id']
          },
        ]
      }
      workout_logs: {
        Row: {
          category: string | null
          completed: boolean
          date: string
          duration_min: number
          id: string
          points: number
          source: string
          title: string | null
          training_type: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          completed?: boolean
          date: string
          duration_min?: number
          id?: string
          points?: number
          source?: string
          title?: string | null
          training_type?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          completed?: boolean
          date?: string
          duration_min?: number
          id?: string
          points?: number
          source?: string
          title?: string | null
          training_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      custom_workouts: {
        Row: {
          id: string
          user_id: string
          title: string
          training_type: string
          rounds: number
          duration_min: number
          exercises: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          training_type?: string
          rounds?: number
          duration_min?: number
          exercises?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          training_type?: string
          rounds?: number
          duration_min?: number
          exercises?: Json
          created_at?: string
        }
        Relationships: []
      }
      extra_suggestions: {
        Row: {
          id: string
          user_id: string | null
          suggestion: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          suggestion: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          suggestion?: string
          created_at?: string
        }
        Relationships: []
      }
      studios: {
        Row: {
          address: string | null
          city: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          owner_user_id: string | null
        }
        Insert: {
          address?: string | null
          city: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          owner_user_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          owner_user_id?: string | null
        }
        Relationships: []
      }
      open_sparrings: {
        Row: {
          id: string
          studio_id: string | null
          created_by: string
          title: string
          discipline: string
          address: string
          lat: number | null
          lng: number | null
          scheduled_at: string
          duration_min: number
          max_slots: number
          notes: string | null
          is_active: boolean
          is_featured: boolean
          is_at_studio: boolean
          created_at: string
        }
        Insert: {
          id?: string
          studio_id?: string | null
          created_by: string
          title: string
          discipline: string
          address: string
          lat?: number | null
          lng?: number | null
          scheduled_at: string
          duration_min?: number
          max_slots?: number
          notes?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_at_studio?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          studio_id?: string | null
          created_by?: string
          title?: string
          discipline?: string
          address?: string
          lat?: number | null
          lng?: number | null
          scheduled_at?: string
          duration_min?: number
          max_slots?: number
          notes?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_at_studio?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'open_sparrings_studio_id_fkey'
            columns: ['studio_id']
            isOneToOne: false
            referencedRelation: 'studios'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'open_sparrings_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sparring_signups: {
        Row: {
          id: string
          sparring_id: string
          user_id: string
          signed_up_at: string
        }
        Insert: {
          id?: string
          sparring_id: string
          user_id: string
          signed_up_at?: string
        }
        Update: {
          id?: string
          sparring_id?: string
          user_id?: string
          signed_up_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sparring_signups_sparring_id_fkey'
            columns: ['sparring_id']
            isOneToOne: false
            referencedRelation: 'open_sparrings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sparring_signups_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sparring_ratings: {
        Row: {
          id:            string
          rater_id:      string
          rated_user_id: string
          sparring_id:   string
          stars:         number
          comment:       string
          created_at:    string
        }
        Insert: {
          id?:           string
          rater_id:      string
          rated_user_id: string
          sparring_id:   string
          stars:         number
          comment:       string
          created_at?:   string
        }
        Update: {
          id?:           string
          rater_id?:     string
          rated_user_id?: string
          sparring_id?:  string
          stars?:        number
          comment?:      string
          created_at?:   string
        }
        Relationships: [
          {
            foreignKeyName: 'sparring_ratings_rater_id_fkey'
            columns: ['rater_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sparring_ratings_rated_user_id_fkey'
            columns: ['rated_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sparring_ratings_sparring_id_fkey'
            columns: ['sparring_id']
            isOneToOne: false
            referencedRelation: 'open_sparrings'
            referencedColumns: ['id']
          },
        ]
      }
      sparring_messages: {
        Row: {
          id:           string
          sparring_id:  string
          sender_id:    string
          recipient_id: string
          content:      string
          read_at:      string | null
          created_at:   string
        }
        Insert: {
          id?:          string
          sparring_id:  string
          sender_id:    string
          recipient_id: string
          content:      string
          read_at?:     string | null
          created_at?:  string
        }
        Update: {
          id?:          string
          sparring_id?: string
          sender_id?:   string
          recipient_id?: string
          content?:     string
          read_at?:     string | null
          created_at?:  string
        }
        Relationships: [
          {
            foreignKeyName: 'sparring_messages_sparring_id_fkey'
            columns: ['sparring_id']
            isOneToOne: false
            referencedRelation: 'open_sparrings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sparring_messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sparring_messages_recipient_id_fkey'
            columns: ['recipient_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sparring_chat_settings: {
        Row: {
          sparring_id:   string
          media_enabled: boolean
        }
        Insert: {
          sparring_id:    string
          media_enabled?: boolean
        }
        Update: {
          sparring_id?:   string
          media_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'sparring_chat_settings_sparring_id_fkey'
            columns: ['sparring_id']
            isOneToOne: true
            referencedRelation: 'open_sparrings'
            referencedColumns: ['id']
          },
        ]
      }
      sparring_group_messages: {
        Row: {
          id:          string
          sparring_id: string
          sender_id:   string
          content:     string | null
          image_url:   string | null
          created_at:  string
        }
        Insert: {
          id?:         string
          sparring_id: string
          sender_id:   string
          content?:    string | null
          image_url?:  string | null
          created_at?: string
        }
        Update: {
          id?:          string
          sparring_id?: string
          sender_id?:   string
          content?:     string | null
          image_url?:   string | null
          created_at?:  string
        }
        Relationships: [
          {
            foreignKeyName: 'sparring_group_messages_sparring_id_fkey'
            columns: ['sparring_id']
            isOneToOne: false
            referencedRelation: 'open_sparrings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sparring_group_messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sparring_chat_reads: {
        Row: {
          user_id:      string
          sparring_id:  string
          last_read_at: string
        }
        Insert: {
          user_id:       string
          sparring_id:   string
          last_read_at?: string
        }
        Update: {
          user_id?:      string
          sparring_id?:  string
          last_read_at?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          id:               string
          reporter_id:      string
          reported_user_id: string
          sparring_id:      string
          reason:           'unsportliches_verhalten' | 'gefaehrliches_verhalten' | 'beleidigung'
          details:          string | null
          created_at:       string
        }
        Insert: {
          id?:              string
          reporter_id:      string
          reported_user_id: string
          sparring_id:      string
          reason:           'unsportliches_verhalten' | 'gefaehrliches_verhalten' | 'beleidigung'
          details?:         string | null
          created_at?:      string
        }
        Update: {
          id?:              string
          reporter_id?:     string
          reported_user_id?: string
          sparring_id?:     string
          reason?:          'unsportliches_verhalten' | 'gefaehrliches_verhalten' | 'beleidigung'
          details?:         string | null
          created_at?:      string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          tier: 'individual' | 'studio'
          billing_cycle: 'monthly' | 'yearly'
          status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive'
          cancel_at_period_end: boolean
          current_period_start: string
          current_period_end: string | null
          included_seats: number
          extra_seats: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tier: 'individual' | 'studio'
          billing_cycle?: 'monthly' | 'yearly'
          status?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive'
          cancel_at_period_end?: boolean
          current_period_start?: string
          current_period_end?: string | null
          included_seats?: number
          extra_seats?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tier?: 'individual' | 'studio'
          billing_cycle?: 'monthly' | 'yearly'
          status?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive'
          cancel_at_period_end?: boolean
          current_period_start?: string
          current_period_end?: string | null
          included_seats?: number
          extra_seats?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      studio_memberships: {
        Row: {
          id: string
          subscription_id: string
          user_id: string
          status: 'active' | 'released'
          assigned_at: string
          released_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          subscription_id: string
          user_id: string
          status?: 'active' | 'released'
          assigned_at?: string
          released_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          subscription_id?: string
          user_id?: string
          status?: 'active' | 'released'
          assigned_at?: string
          released_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      studio_invites: {
        Row: {
          id: string
          subscription_id: string
          email: string
          token: string
          status: 'pending' | 'accepted' | 'revoked' | 'expired'
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          subscription_id: string
          email: string
          token: string
          status?: 'pending' | 'accepted' | 'revoked' | 'expired'
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          subscription_id?: string
          email?: string
          token?: string
          status?: 'pending' | 'accepted' | 'revoked' | 'expired'
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
      studio_invite_codes: {
        Row: {
          id: string
          studio_id: string
          code: string
          expires_at: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          code: string
          expires_at: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          studio_id?: string
          code?: string
          expires_at?: string
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      team_announcements: {
        Row: {
          id: string
          studio_id: string
          coach_id: string
          message: string
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          studio_id: string
          coach_id: string
          message: string
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          studio_id?: string
          coach_id?: string
          message?: string
          created_at?: string
          expires_at?: string | null
        }
        Relationships: []
      }
      attendance_logs: {
        Row: {
          id: string
          studio_id: string
          user_id: string
          session_date: string
          points_awarded: number
          marked_by: string
          created_at: string
        }
        Insert: {
          id?: string
          studio_id: string
          user_id: string
          session_date?: string
          points_awarded?: number
          marked_by: string
          created_at?: string
        }
        Update: {
          id?: string
          studio_id?: string
          user_id?: string
          session_date?: string
          points_awarded?: number
          marked_by?: string
          created_at?: string
        }
        Relationships: []
      }
      map_boosts: {
        Row: {
          id:           string
          user_id:      string
          sparring_id:  string
          activated_at: string
          expires_at:   string
          is_active:    boolean
        }
        Insert: {
          id?:           string
          user_id:       string
          sparring_id:   string
          activated_at?: string
          expires_at:    string
          is_active?:    boolean
        }
        Update: {
          id?:           string
          user_id?:      string
          sparring_id?:  string
          activated_at?: string
          expires_at?:   string
          is_active?:    boolean
        }
        Relationships: [
          {
            foreignKeyName: 'map_boosts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'map_boosts_sparring_id_fkey'
            columns: ['sparring_id']
            isOneToOne: false
            referencedRelation: 'open_sparrings'
            referencedColumns: ['id']
          },
        ]
      }
      water_logs: {
        Row: {
          id: string
          user_id: string
          date: string
          amount_ml: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          amount_ml: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          amount_ml?: number
          created_at?: string
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          id: string
          user_id: string
          week_start: string
          weight_kg: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          week_start: string
          weight_kg: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          week_start?: string
          weight_kg?: number
          created_at?: string
        }
        Relationships: []
      }
      coach_nominations: {
        Row: {
          id: string
          nominee_id: string
          nominator_id: string
          team_id: string
          type: 'promote' | 'demote'
          status: 'pending' | 'confirmed' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          nominee_id: string
          nominator_id: string
          team_id: string
          type: 'promote' | 'demote'
          status?: 'pending' | 'confirmed' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          nominee_id?: string
          nominator_id?: string
          team_id?: string
          type?: 'promote' | 'demote'
          status?: 'pending' | 'confirmed' | 'rejected'
          created_at?: string
        }
        Relationships: []
      }
      coach_votes: {
        Row: {
          id: string
          nomination_id: string
          voter_id: string
          created_at: string
        }
        Insert: {
          id?: string
          nomination_id: string
          voter_id: string
          created_at?: string
        }
        Update: {
          id?: string
          nomination_id?: string
          voter_id?: string
          created_at?: string
        }
        Relationships: []
      }
      fight_records: {
        Row: {
          id:            string
          user_id:       string
          result:        'win' | 'loss' | 'draw'
          method:        'ko' | 'tko' | 'submission' | 'decision' | null
          opponent_name: string | null
          organization:  string | null
          fight_date:    string | null
          created_at:    string
        }
        Insert: {
          id?:            string
          user_id:        string
          result:         'win' | 'loss' | 'draw'
          method?:        'ko' | 'tko' | 'submission' | 'decision' | null
          opponent_name?: string | null
          organization?:  string | null
          fight_date?:    string | null
          created_at?:    string
        }
        Update: {
          result?:        'win' | 'loss' | 'draw'
          method?:        'ko' | 'tko' | 'submission' | 'decision' | null
          opponent_name?: string | null
          organization?:  string | null
          fight_date?:    string | null
        }
        Relationships: []
      }
      user_schedule: {
        Row: {
          id: string
          user_id: string
          day_of_week: number
          training_name: string
          start_time: string
          duration_min: number
          coach_name: string | null
          points_per_30min: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          day_of_week: number
          training_name: string
          start_time: string
          duration_min?: number
          coach_name?: string | null
          points_per_30min?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          day_of_week?: number
          training_name?: string
          start_time?: string
          duration_min?: number
          coach_name?: string | null
          points_per_30min?: number
          created_at?: string
        }
        Relationships: []
      }
      studio_schedule: {
        Row: {
          coach_name: string | null
          created_at: string
          day_of_week: number
          duration_min: number
          id: string
          is_active: boolean
          points_per_30min: number
          start_time: string
          studio_id: string | null
          training_name: string
          training_type: string
        }
        Insert: {
          coach_name?: string | null
          created_at?: string
          day_of_week: number
          duration_min?: number
          id?: string
          is_active?: boolean
          points_per_30min?: number
          start_time: string
          studio_id?: string | null
          training_name: string
          training_type: string
        }
        Update: {
          coach_name?: string | null
          created_at?: string
          day_of_week?: number
          duration_min?: number
          id?: string
          is_active?: boolean
          points_per_30min?: number
          start_time?: string
          studio_id?: string | null
          training_name?: string
          training_type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'studio_schedule_studio_id_fkey'
            columns: ['studio_id']
            isOneToOne: false
            referencedRelation: 'studios'
            referencedColumns: ['id']
          },
        ]
      }
      schedule_participations: {
        Row: {
          created_at: string
          id: string
          points_earned: number
          schedule_id: string
          session_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_earned?: number
          schedule_id: string
          session_date: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_earned?: number
          schedule_id?: string
          session_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'schedule_participations_schedule_id_fkey'
            columns: ['schedule_id']
            isOneToOne: false
            referencedRelation: 'studio_schedule'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_workout_points: {
        Args: { p_user_id: string; p_date: string; p_points: number }
        Returns: undefined
      }
      deduct_workout_points: {
        Args: { p_user_id: string; p_points: number }
        Returns: undefined
      }
      cast_coach_vote: {
        Args: { p_nomination_id: string }
        Returns: Json
      }
      reject_coach_nomination: {
        Args: { p_nomination_id: string }
        Returns: Json
      }
      self_demote_coach: {
        Args: Record<string, never>
        Returns: Json
      }
      mark_attendance: {
        Args: { p_studio_id: string; p_user_id: string; p_session_date?: string; p_points?: number }
        Returns: Json
      }
      unmark_attendance: {
        Args: { p_studio_id: string; p_user_id: string; p_session_date?: string }
        Returns: Json
      }
      get_my_entitlement: {
        Args: Record<string, never>
        Returns: {
          has_access: boolean
          tier: string | null
          source: string | null
          can_create_studio: boolean
          included_seats: number
          used_seats: number
          extra_seats: number
        }[]
      }
      create_studio_with_owner: {
        Args: { p_name: string; p_city: string }
        Returns: {
          id: string
          name: string
          city: string
        }[]
      }
      create_studio_invite: {
        Args: { p_studio_id: string }
        Returns: string
      }
      accept_studio_invite: {
        Args: { p_code: string }
        Returns: string
      }
      delete_my_account: {
        Args: Record<string, never>
        Returns: undefined
      }
      deactivate_sparring: {
        Args: { p_id: string }
        Returns: undefined
      }
      get_subscribed_studios: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          city: string
          address: string | null
          lat: number
          lng: number
        }[]
      }
      log_daily_activity: {
        Args: {
          p_user_id: string
          p_date: string
          p_title: string
          p_training_type: string
          p_points: number
          p_duration_min: number
        }
        Returns: Json
      }
      activate_map_boost: {
        Args: {
          p_sparring_id:   string
          p_user_id:       string
          p_duration_days?: number
        }
        Returns: Json
      }
      get_my_boost_status: {
        Args: { p_sparring_id: string }
        Returns: {
          is_active:      boolean
          expires_at:     string | null
          days_remaining: number | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type WorkoutLog = Database['public']['Tables']['workout_logs']['Row']
export type Studio = Database['public']['Tables']['studios']['Row']
export type StudioSchedule = Database['public']['Tables']['studio_schedule']['Row']
export type ScheduleParticipation = Database['public']['Tables']['schedule_participations']['Row']
export type UserSchedule = Database['public']['Tables']['user_schedule']['Row']
export type UserScheduleInsert = Database['public']['Tables']['user_schedule']['Insert']

// Minimal shape needed to render a schedule entry in DayBlock
export type ScheduleDisplayItem = {
  id: string
  day_of_week: number
  training_name: string
  start_time: string
  duration_min: number
  coach_name: string | null
}

export type WorkoutLogInsert = Database['public']['Tables']['workout_logs']['Insert']
export type ScheduleParticipationInsert = Database['public']['Tables']['schedule_participations']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

// Participation status values
export type ParticipationStatus = 'confirmed' | 'attended' | 'missed' | 'cancelled'

// Training categories
export type TrainingCategory = 'Studio' | 'Spezifisch' | 'Cardio' | 'Kraft' | 'Recovery' | 'Explosivkraft' | 'Extra'

// Workout log source
export type WorkoutSource = 'plan' | 'module' | 'extra' | 'manual'

// Extra suggestions
export type ExtraSuggestion = Database['public']['Tables']['extra_suggestions']['Row']
export type ExtraSuggestionInsert = Database['public']['Tables']['extra_suggestions']['Insert']

// Coach system
export type TeamAnnouncement = Database['public']['Tables']['team_announcements']['Row']
export type TeamAnnouncementInsert = Database['public']['Tables']['team_announcements']['Insert']
export type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row']

export type CustomWorkout = Database['public']['Tables']['custom_workouts']['Row']
export type CustomWorkoutInsert = Database['public']['Tables']['custom_workouts']['Insert']

export interface CustomExercise {
  name: string;
  duration: string;
  pause: string;
}

export type WaterLog = Database['public']['Tables']['water_logs']['Row']
export type WaterLogInsert = Database['public']['Tables']['water_logs']['Insert']

export type WeightLog = Database['public']['Tables']['weight_logs']['Row']
export type WeightLogInsert = Database['public']['Tables']['weight_logs']['Insert']

export type CoachNomination = Database['public']['Tables']['coach_nominations']['Row']
export type CoachNominationInsert = Database['public']['Tables']['coach_nominations']['Insert']
export type CoachVote = Database['public']['Tables']['coach_votes']['Row']
export type Subscription = Database['public']['Tables']['subscriptions']['Row']
export type StudioMembership = Database['public']['Tables']['studio_memberships']['Row']
export type StudioInvite = Database['public']['Tables']['studio_invites']['Row']
export type StudioInviteCode = Database['public']['Tables']['studio_invite_codes']['Row']

export type FightRecord = Database['public']['Tables']['fight_records']['Row']
export type FightRecordInsert = Database['public']['Tables']['fight_records']['Insert']

export type NominationType = 'promote' | 'demote'
export type NominationStatus = 'pending' | 'confirmed' | 'rejected'

export type SparringRating = Database['public']['Tables']['sparring_ratings']['Row']
export type SparringRatingInsert = Database['public']['Tables']['sparring_ratings']['Insert']
export type UserReport = Database['public']['Tables']['user_reports']['Row']
export type UserReportInsert = Database['public']['Tables']['user_reports']['Insert']
export type ReportReason = 'unsportliches_verhalten' | 'gefaehrliches_verhalten' | 'beleidigung'
export type SparringMessage = Database['public']['Tables']['sparring_messages']['Row']
export type SparringMessageInsert = Database['public']['Tables']['sparring_messages']['Insert']
export type SparringGroupMessage        = Database['public']['Tables']['sparring_group_messages']['Row']
export type SparringGroupMessageInsert  = Database['public']['Tables']['sparring_group_messages']['Insert']
export type SparringChatSettings        = Database['public']['Tables']['sparring_chat_settings']['Row']
export type SparringChatSettingsInsert  = Database['public']['Tables']['sparring_chat_settings']['Insert']
export type SparringChatReads           = Database['public']['Tables']['sparring_chat_reads']['Row']
export type SparringChatReadsInsert     = Database['public']['Tables']['sparring_chat_reads']['Insert']

// Nomination enriched with display data (computed in hook)
export interface CoachNominationDetails {
  id: string
  nominee_id: string
  nominator_id: string
  team_id: string
  type: NominationType
  status: NominationStatus
  created_at: string
  nominee_name: string | null
  nominator_name: string | null
  vote_count: number
  has_voted: boolean      // current user has already voted
  can_confirm: boolean    // current user is eligible to confirm
  can_reject: boolean     // current user is eligible to reject
}
