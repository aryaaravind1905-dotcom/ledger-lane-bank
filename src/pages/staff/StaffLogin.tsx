import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Headset } from "lucide-react";
import { toast } from "sonner";

const STAFF_KEY = "demo-staff";

export default function StaffLogin() {
  const navigate = useNavigate();
  const [user, setUser] = useState("staff");
  const [pass, setPass] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("staff_key") === STAFF_KEY) navigate("/staff/tickets", { replace: true });
  }, [navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user === "staff" && pass === "demo1234") {
      sessionStorage.setItem("staff_key", STAFF_KEY);
      navigate("/staff/tickets");
    } else {
      toast.error("Invalid credentials. Try staff / demo1234");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Headset className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl leading-none">Staff Console</h1>
            <p className="text-xs text-muted-foreground mt-1">Lovable Bank • Demo</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Username</Label>
            <Input value={user} onChange={(e) => setUser(e.target.value)} />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="demo1234" />
          </div>
          <Button type="submit" className="w-full">Sign in</Button>
          <p className="text-xs text-muted-foreground text-center">Demo creds: <code>staff / demo1234</code></p>
        </form>
      </Card>
    </div>
  );
}
