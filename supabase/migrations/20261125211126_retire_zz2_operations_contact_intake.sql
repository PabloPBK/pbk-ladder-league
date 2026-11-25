begin;

-- Keep prior inquiries available to the existing authorized reader.
revoke execute on function public.submit_zz2_contact_inquiry(text, text, text, text, text) from service_role;
revoke insert on public.zz2_contact_inquiries from service_role;

notify pgrst, 'reload schema';

commit;
