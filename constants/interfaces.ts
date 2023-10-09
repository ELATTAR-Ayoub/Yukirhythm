// project.ts

export interface Project {
  ID: string;
  title: string;
  date?: string;
  completed: boolean;
}

export interface Offer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  additionalInfo: string;
  reasons: string[];
}
