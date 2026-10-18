import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="display text-3xl text-ink">找不到這個頁面</h1>
      <p className="mt-2 text-ink-2">連結可能打錯了，或你沒有權限看這個內容。</p>
      <ButtonLink href="/home" className="mt-6 self-start">
        回到首頁
      </ButtonLink>
    </main>
  );
}
