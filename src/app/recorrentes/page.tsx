import { redirect } from "next/navigation";

export default function RecorrentesRedirect() {
  redirect("/despesas?tab=recorrentes");
}
