export type TicketStatus =
  | 'open'
  | 'pending'
  | 'waiting_customer'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type CustomerSupportType = 'retail' | 'wholesale';

export type TicketCategory =
  | 'orders'
  | 'shipping'
  | 'payments'
  | 'wholesale_b2b'
  | 'product_inquiry'
  | 'returns'
  | 'general';

export interface TicketAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface TicketMessage {
  id: string;
  sender: 'customer' | 'admin' | 'system';
  sender_name?: string;
  message: string;
  attachments?: TicketAttachment[];
  is_internal?: boolean;
  created_at: string;
}

export interface TicketActivityLog {
  id: string;
  ticket_id: string;
  action: string;
  details: string;
  performed_by: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  customer_type: CustomerSupportType;
  company_name?: string | null;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  order_id?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  unread_by_admin: boolean;
  unread_by_customer: boolean;
  internal_notes?: string | null;
  messages: TicketMessage[];
  attachments?: TicketAttachment[];
  activity_log?: TicketActivityLog[];
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  first_response_at?: string | null;
}

export interface SupportAgent {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  is_online: boolean;
  active_tickets_count: number;
}

export interface SupportCannedResponse {
  id: string;
  title: string;
  category: string;
  content_ar: string;
  content_fr: string;
}

export interface SupportNotification {
  id: string;
  type: 'new_ticket' | 'new_reply' | 'ticket_closed' | 'ticket_assigned';
  ticket_id: string;
  ticket_number: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface LiveChatMessage {
  id: string;
  session_id: string;
  sender: 'customer' | 'agent' | 'bot';
  sender_name: string;
  text: string;
  timestamp: string;
  attachments?: TicketAttachment[];
}

export interface LiveChatSession {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_type: CustomerSupportType;
  status: 'active' | 'waiting' | 'ended';
  started_at: string;
  last_message: string;
  unread_count: number;
  assigned_agent_id?: string;
  messages: LiveChatMessage[];
}
