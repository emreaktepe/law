import { supabase } from "../lib/supabase.js";
const result = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};
const client = () => {
  if (!supabase) throw new Error("Canlı bağlantı henüz yapılandırılmadı.");
  return supabase;
};
export const liveRepository = {
  async getIdentity(userId) {
    const [account, applications, memberships] = await Promise.all([
      result(
        client()
          .from("lr_accounts")
          .select("user_id,display_name,role,status")
          .eq("user_id", userId)
          .maybeSingle(),
      ),
      result(
        client()
          .from("lr_applications")
          .select("id,kind,display_name,status,created_at")
          .eq("applicant_id", userId)
          .order("created_at", { ascending: false }),
      ),
      result(
        client()
          .from("lr_memberships")
          .select("organization_id,role,active")
          .eq("user_id", userId)
          .eq("active", true),
      ),
    ]);
    return { account, application: applications[0] || null, memberships };
  },
  submitApplication: (form) =>
    result(
      client().rpc("lr_submit_application", {
        p_kind: form.kind,
        p_display_name: form.display_name.trim(),
        p_bar_number: form.bar_number?.trim() || null,
        p_organization_name: form.organization_name?.trim() || null,
        p_referral_code: form.referral_code?.trim().toUpperCase() || null,
      }),
    ),
  listMatters: () =>
    result(
      client()
        .from("lr_matters")
        .select(
          "id,organization_id,title,matter_type,reference,court,stage,next_action,target_date,client_summary,archived_at",
        )
        .is("archived_at", null)
        .order("created_at", { ascending: false }),
    ),
  createMatter: (organizationId, userId, value) =>
    result(
      client()
        .from("lr_matters")
        .insert({
          organization_id: organizationId,
          owner_id: userId,
          title: value.title,
          matter_type: value.matter_type,
          reference: value.reference || null,
          court: value.court || null,
          next_action: value.next_action || null,
          target_date: value.target_date || null,
        })
        .select("id")
        .single(),
    ),
  listEvents: (matterId) =>
    result(
      client()
        .from("lr_events")
        .select("id,title,occurred_on,shared")
        .eq("matter_id", matterId)
        .order("occurred_on", { ascending: false }),
    ),
  listMessages: (matterId) =>
    result(
      client()
        .from("lr_messages")
        .select("id,body,sender_id,created_at")
        .eq("matter_id", matterId)
        .order("created_at"),
    ),
  sendMessage: (matterId, userId, body) =>
    result(
      client()
        .from("lr_messages")
        .insert({ matter_id: matterId, sender_id: userId, body }),
    ),
  listDocuments: (matterId) =>
    result(
      client()
        .from("lr_documents")
        .select("id,name,media_type,shared,created_at")
        .eq("matter_id", matterId)
        .order("created_at", { ascending: false }),
    ),
  async downloadDocument(id) {
    const path = await result(
      client().rpc("lr_document_download_path", { p_document: id }),
    );
    return result(client().storage.from("lr-matter-files").download(path));
  },
  async uploadDocument(matterId, file) {
    const reservation = await result(
      client().rpc("lr_reserve_document", {
        p_matter: matterId,
        p_name: file.name,
        p_media_type: file.type || "application/octet-stream",
        p_size: file.size,
      }),
    );
    await result(
      client()
        .storage.from("lr-matter-files")
        .upload(reservation.object_path, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        }),
    );
    await result(
      client().rpc("lr_finalize_document", { p_document: reservation.id }),
    );
    return reservation;
  },
  setDocumentSharing: (id, shared) =>
    result(
      client().rpc("lr_share_document", { p_document: id, p_shared: shared }),
    ),
  listApplications: () =>
    result(
      client()
        .from("lr_applications")
        .select(
          "id,kind,display_name,organization_name,bar_number,status,created_at",
        )
        .eq("status", "pending")
        .order("created_at"),
    ),
  reviewApplication: (id, approved, reason) =>
    result(
      client().rpc("lr_review_application", {
        p_application: id,
        p_approve: approved,
        p_reason: reason || null,
      }),
    ),
  listRelationships: async () =>
    (await result(client().rpc("lr_list_clients")))
      .filter((r) => r.status === "lawyer_review")
      .map((r) => ({ ...r, id: r.relationship_id })),
  listClients: async () =>
    (await result(client().rpc("lr_list_clients"))).filter(
      (r) => r.status === "accepted",
    ),
  listMatterSharing: (matterId) =>
    result(
      client()
        .from("lr_matter_clients")
        .select("relationship_id,shared")
        .eq("matter_id", matterId),
    ),
  shareMatter: (matterId, relationshipId, shared) =>
    result(
      client().rpc("lr_share_matter", {
        p_matter: matterId,
        p_relationship: relationshipId,
        p_shared: shared,
      }),
    ),
  getReferralCode: (userId) =>
    result(
      client()
        .from("lr_referral_codes")
        .select("code")
        .eq("lawyer_id", userId)
        .maybeSingle(),
    ),
  acceptRelationship: (id, accept) =>
    result(
      client().rpc("lr_review_relationship", {
        p_relationship: id,
        p_accept: accept,
      }),
    ),
  listAssignableLawyers: () => result(client().rpc("lr_assignable_lawyers")),
  assignClient: (applicationId, lawyerId) =>
    result(
      client().rpc("lr_assign_client", {
        p_application: applicationId,
        p_lawyer: lawyerId,
      }),
    ),
};
