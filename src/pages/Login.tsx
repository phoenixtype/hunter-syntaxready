
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const Login = () => {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background transition-colors duration-500">
            <div className="w-full max-w-md animate-scale-in">
                <div className="glass-card rounded-2xl p-8 md:p-12 space-y-8">
                    <div className="space-y-2 text-center">
                        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
                        <p className="text-muted-foreground text-sm">Enter your credentials to access your agent</p>
                    </div>

                    <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                        <div className="space-y-2">
                            <Input
                                type="email"
                                placeholder="name@example.com"
                                className="bg-transparent border-muted h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="Password"
                                className="bg-transparent border-muted h-12"
                            />
                        </div>
                        <Button className="w-full h-12 text-base font-medium transition-transform hover:scale-[1.02] active:scale-[0.98]">
                            Sign In
                        </Button>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-muted/50" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                            </div>
                        </div>
                        <Button variant="outline" className="w-full h-12 hover:bg-muted/50" onClick={() => console.log("Dummy login")}>
                            Dummy Account
                        </Button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground">
                        Don't have an account?{" "}
                        <Link to="/signup" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                            Sign up <ArrowRight className="w-3 h-3" />
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
