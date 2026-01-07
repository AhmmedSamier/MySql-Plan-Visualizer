export type Plan = [string, string, string, string]; // name, plan, query, date
export type Sample = [string, string, string]; // name, plan, query
export type ActivePlan = [string, string, string, number?]; // plan, query, name, id

export interface PlanObject {
  id: number;
  name: string;
  plan: string;
  query: string;
  created_at: Date;
}
