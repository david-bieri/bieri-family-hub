export interface Child {
  id: string;
  name: string;
  birthdate: string;
  colorClass: string;
  textClass: string;
  bgLight: string;
}

export const CHILDREN: Child[] = [
  { id: "cole",   name: "Cole",   birthdate: "2012-06-29", colorClass: "child-cole",   textClass: "text-blue-600 dark:text-blue-400",   bgLight: "bg-blue-50 dark:bg-blue-950" },
  { id: "greta",  name: "Greta",  birthdate: "2013-09-25", colorClass: "child-greta",  textClass: "text-purple-600 dark:text-purple-400", bgLight: "bg-purple-50 dark:bg-purple-950" },
  { id: "airlie", name: "Airlie", birthdate: "2015-03-09", colorClass: "child-airlie", textClass: "text-green-600 dark:text-green-400",   bgLight: "bg-green-50 dark:bg-green-950" },
  { id: "clara",  name: "Clara",  birthdate: "2016-08-23", colorClass: "child-clara",  textClass: "text-amber-600 dark:text-amber-400",   bgLight: "bg-amber-50 dark:bg-amber-950" },
  { id: "heidi",  name: "Heidi",  birthdate: "2023-03-09", colorClass: "child-heidi",  textClass: "text-rose-500 dark:text-rose-400",     bgLight: "bg-rose-50 dark:bg-rose-950" },
  { id: "daisy",  name: "Daisy",  birthdate: "2025-01-28", colorClass: "child-daisy",  textClass: "text-teal-600 dark:text-teal-400",     bgLight: "bg-teal-50 dark:bg-teal-950" },
];

export function getChild(id: string) {
  return CHILDREN.find(c => c.id === id);
}

export function getAge(birthdate: string): string {
  const born = new Date(birthdate);
  const now = new Date();
  const months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (months < 24) return `${months}mo`;
  const years = Math.floor(months / 12);
  return `${years}`;
}

export function getFullAge(birthdate: string): string {
  const born = new Date(birthdate);
  const now = new Date();
  const months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (months < 24) return `${months} months`;
  const years = Math.floor(months / 12);
  return `${years} years old`;
}
