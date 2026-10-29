
"use server";

import { revalidatePath } from "next/cache";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PaymentStatus = "unpaid" | "paid" | "waived";

type UpdatePaymentRequest = {
  attendanceId: string;
  paymentStatus: PaymentStatus;
  paymentNotes?: string;
};

type ActionResult = {
  success: boolean;
  message: string;
};

function validUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function updatePB101Payment(
  request: UpdatePaymentRequest
): Promise<ActionResult> {
  await requireStaffUser();

  if (!validUUID(request.attendanceId)) {
    return {
      success: false,
      message: "Invalid attendance record.",
    };
  }

  const allowedStatuses: PaymentStatus[] = [
    "unpaid",
    "paid",
    "waived",
  ];

  if (!allowedStatuses.includes(request.paymentStatus)) {
    return {
      success: false,
      message: "Invalid payment status.",
    };
  }

  const { data: activity, error: lookupError } =
    await supabaseAdmin
      .from("pb101_attendance")
      .select(
        "id, program, is_included, charge_amount, payment_status"
      )
      .eq("id", request.attendanceId)
      .maybeSingle();

  if (lookupError || !activity) {
    return {
      success: false,
      message: "Attendance record not found.",
    };
  }

  // Only outside-program activities can be billed.
  if (
    activity.program !== "other" ||
    activity.is_included === true
  ) {
    return {
      success: false,
      message:
        "Complimentary PB101+ activities cannot be charged.",
    };
  }

  const notes = request.paymentNotes?.trim() ?? "";

  if (notes.length > 1000) {
    return {
      success: false,
      message: "Payment notes must be under 1,000 characters.",
    };
  }

  // Require an explanation when waiving a charge.
  if (request.paymentStatus === "waived" && !notes) {
    return {
      success: false,
      message: "Enter a reason for waiving the charge.",
    };
  }

  const { error: updateError } = await supabaseAdmin
    .from("pb101_attendance")
    .update({
      payment_status: request.paymentStatus,
      payment_notes: notes || null,
    })
    .eq("id", request.attendanceId)
    .eq("program", "other");

  if (updateError) {
    console.error(
      "PB101 payment update error:",
      updateError
    );

    return {
      success: false,
      message: "Unable to update payment status.",
    };
  }

  revalidatePath("/admin/pb101/attendance");
  revalidatePath("/admin/pb101/reports");

  const messages: Record<PaymentStatus, string> = {
    unpaid: "Charge marked as unpaid.",
    paid: "Charge marked as paid.",
    waived: "Charge waived successfully.",
  };

  return {
    success: true,
    message: messages[request.paymentStatus],
  };
}
