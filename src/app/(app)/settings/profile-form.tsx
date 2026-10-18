"use client";

import { useState } from "react";
import { updateProfile } from "@/app/actions/fit";
import { Button, ErrorText, Input, Label, Textarea } from "@/components/ui";
import { useAction } from "@/components/use-action";
import type { Role } from "@/lib/types";

export function ProfileForm(props: { displayName: string; phone: string; bio: string; role: Role }) {
  const [name, setName] = useState(props.displayName);
  const [phone, setPhone] = useState(props.phone);
  const [bio, setBio] = useState(props.bio);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useAction();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        run(() => updateProfile(name, phone, bio), () => setSaved(true));
      }}
    >
      <div>
        <Label htmlFor="name">名字</Label>
        <Input id="name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="phone" hint="選填，只有你的教練或學員看得到">
          電話
        </Label>
        <Input id="phone" type="tel" inputMode="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {props.role === "coach" ? (
        <div>
          <Label htmlFor="bio" hint="選填，300 字以內">
            教練介紹
          </Label>
          <Textarea id="bio" value={bio} maxLength={300} onChange={(e) => setBio(e.target.value)} />
        </div>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "儲存中…" : "儲存"}
        </Button>
        {saved && !pending ? <span className="text-sm text-go">已儲存</span> : null}
      </div>
    </form>
  );
}
