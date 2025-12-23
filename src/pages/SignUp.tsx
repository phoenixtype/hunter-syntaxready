
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const SignUp = () => {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background transition-colors duration-500">
            <div className="w-full max-w-md animate-fadeInUp">
                <div className="glass-card rounded-2xl p-8 md:p-12 space-y-8">
                    <div className="space-y-2 text-center">
                        <h1 className="text-3xl font-semibold tracking-tight">Create an account</h1>
                        <p className="text-muted-foreground text-sm">Start your autonomous job search today</p>
                    </div>

                    <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                        <div className="space-y-2">
                            <Input
                                type="text"
                                placeholder="Full Name"
                                className="bg-transparent border-muted h-12"
                            />
                        </div>
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
                            Create Account
                        </Button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link to="/login" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                            Sign in <ArrowRight className="w-3 h-3" />
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SignUp;
