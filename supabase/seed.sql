-- NORAV V0.1 — Seed data (idempotent).
-- Reference data only. Dev/test USERS are created by scripts/seed-dev.ts
-- (service role required) — never here.

-- Skills catalog: language-neutral keys, labels are translated in the UI.
insert into public.skills (skill_key, category) values
  ('care_basics', 'healthcare'),
  ('patient_support', 'healthcare'),
  ('hotel_service', 'hospitality'),
  ('kitchen_basics', 'hospitality'),
  ('retail_sales', 'commerce'),
  ('warehouse_logistics', 'logistics'),
  ('metal_working', 'crafts'),
  ('electrical_basics', 'crafts'),
  ('it_support', 'it'),
  ('office_administration', 'administration'),
  ('customer_service', 'general'),
  ('teamwork', 'general')
on conflict (skill_key) do nothing;

-- Plans: 'free' and 'paid' as required by §17. No pricing is defined in V0.1.
insert into public.plans (plan_key, name, description) values
  ('free', 'Free', 'Default plan. Pricing and paid features are defined post-V0.1.'),
  ('paid', 'Paid', 'Placeholder for the future paid plan. No pricing defined in V0.1.')
on conflict (plan_key) do nothing;

-- Placeholder entitlement keys (feature access will be entitlement-based).
insert into public.plan_entitlements (plan_id, entitlement_key, limit_value)
select p.id, e.entitlement_key, e.limit_value
from public.plans p
join (values
  ('free', 'profile_publication', 1),
  ('paid', 'profile_publication', 1),
  ('paid', 'priority_review', null::int)
) as e(plan_key, entitlement_key, limit_value)
  on e.plan_key = p.plan_key
on conflict (plan_id, entitlement_key) do nothing;
