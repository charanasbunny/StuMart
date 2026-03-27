import { supabase } from './supabaseClient';
import { getCurrentUser } from './authService';

/**
 * Create a payment order on server (gateway secret stays server-side).
 */
export async function createGatewayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  try {
    const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
      body: { amount, currency, receipt, notes },
    });
    if (error) return { success: false, data: null, error: error.message || 'Failed to create payment order' };
    if (data?.error) return { success: false, data: null, error: data.error };
    return { success: true, data, error: null };
  } catch (e) {
    return { success: false, data: null, error: e.message || 'Failed to create payment order' };
  }
}

/**
 * Verify payment signature on server.
 */
export async function verifyGatewayPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  try {
    const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
      body: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
    });
    if (error) return { success: false, data: null, error: error.message || 'Payment verification failed' };
    if (data?.error) return { success: false, data: null, error: data.error };
    return { success: true, data, error: null };
  } catch (e) {
    return { success: false, data: null, error: e.message || 'Payment verification failed' };
  }
}

/**
 * Create an order (buyer submits payment details after paying via QR).
 * Requires logged-in student; buyer_student_pin must match current student.
 */
export async function createOrder({
  product_id,
  buyer_student_pin,
  buyer_name,
  buyer_email,
  amount_paid,
  tx_reference,
  payment_method,
  delivery_preference,
  notes,
}) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        product_id,
        buyer_student_pin: String(buyer_student_pin).trim(),
        buyer_name: buyer_name ? String(buyer_name).trim() : null,
        buyer_email: buyer_email ? String(buyer_email).trim() : null,
        amount_paid: parseInt(amount_paid, 10) || 0,
        tx_reference: String(tx_reference).trim(),
        payment_method: String(payment_method || 'Other').trim(),
        delivery_preference: delivery_preference ? String(delivery_preference).trim() : null,
        notes: notes ? String(notes).trim() : null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return { success: false, data: null, error: error.message };
    }
    return { success: true, data, error: null };
  } catch (e) {
    return { success: false, data: null, error: e.message || 'Failed to create order' };
  }
}

/**
 * Admin: list orders with optional status filter.
 * Joins product and buyer student for display.
 */
export async function getOrders({ status } = {}) {
  try {
    let query = supabase
      .from('orders')
      .select(`
        id,
        product_id,
        buyer_student_pin,
        buyer_name,
        buyer_email,
        amount_paid,
        tx_reference,
        payment_method,
        delivery_preference,
        notes,
        status,
        created_at,
        updated_at,
        products:product_id ( id, title, price, student_pin_number, status )
      `)
      .order('created_at', { ascending: false });

    if (status && ['pending', 'verified', 'delivered'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, data: null, error: error.message };
    }
    return { success: true, data: data || [], error: null };
  } catch (e) {
    return { success: false, data: null, error: e.message || 'Failed to fetch orders' };
  }
}

/**
 * Admin: update order status (verified / delivered).
 * When status is 'delivered', the associated product is auto-marked as 'sold'.
 */
export async function updateOrderStatus(orderId, status) {
  if (!['verified', 'delivered'].includes(status)) {
    return { success: false, error: 'Invalid status' };
  }
  try {
    // Fetch order first to get product_id (needed when marking delivered)
    const { data: order } = await supabase
      .from('orders')
      .select('id, product_id')
      .eq('id', orderId)
      .single();

    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      return { success: false, data: null, error: error.message };
    }

    // When delivered, mark product as sold (out of stock)
    if (status === 'delivered' && order?.product_id) {
      await supabase.from('products').update({ status: 'sold' }).eq('id', order.product_id);
    }

    return { success: true, data, error: null };
  } catch (e) {
    return { success: false, data: null, error: e.message || 'Failed to update order' };
  }
}

/**
 * Buyer: list my orders (by current student's pin).
 */
export async function getMyOrders() {
  const { student, error: userError } = await getCurrentUser();
  if (userError || !student) {
    return { success: false, data: null, error: 'Not logged in or student not found' };
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        product_id,
        amount_paid,
        tx_reference,
        payment_method,
        status,
        created_at,
        products:product_id ( id, title, price, image_urls )
      `)
      .eq('buyer_student_pin', student.pin_number)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, data: null, error: error.message };
    }
    return { success: true, data: data || [], error: null };
  } catch (e) {
    return { success: false, data: null, error: e.message || 'Failed to fetch orders' };
  }
}
