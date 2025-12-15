import React, { useState } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Label } from '@/components/ui/label';
    import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
    import { Loader2, Send, Tag, Info } from 'lucide-react';
    import { motion } from 'framer-motion';

    const RequestCreatorTagsTab = () => {
        const { user } = useAuth();
        const [requestedTags, setRequestedTags] = useState('');
        const [additionalInfo, setAdditionalInfo] = useState('');
        const [isLoading, setIsLoading] = useState(false);

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!user) {
                toast({ title: "Not Authenticated", description: "You must be logged in to request creator tags.", variant: "error" });
                return;
            }
            if (!requestedTags.trim()) {
                toast({ title: "Tags Required", description: "Please enter at least one tag.", variant: "error" });
                return;
            }

            setIsLoading(true);
            const tagsArray = requestedTags.split(',').map(tag => tag.trim()).filter(tag => tag);

            try {
                const { error } = await supabase
                    .from('creator_tag_requests')
                    .insert({
                        user_id: user.id,
                        requested_tags: tagsArray,
                        additional_info: additionalInfo.trim() || null,
                        status: 'pending'
                    });

                if (error) throw error;

                toast({
                    title: "Request Submitted!",
                    description: "Your creator tag request has been sent for review.",
                    variant: "success"
                });
                setRequestedTags('');
                setAdditionalInfo('');
            } catch (error) {
                toast({
                    title: "Submission Failed",
                    description: error.message || "Could not submit your request. Please try again.",
                    variant: "error"
                });
            } finally {
                setIsLoading(false);
            }
        };

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="p-0 sm:p-2"
            >
                <Card className="w-full max-w-2xl mx-auto glass-effect">
                    <CardHeader className="text-center">
                        <Tag className="w-12 h-12 golden-text mx-auto mb-3" />
                        <CardTitle className="text-3xl">Request Creator Tags</CardTitle>
                        <CardDescription className="text-gray-400 text-base">
                            Apply to become a verified creator and get tags to showcase your skills.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <Label htmlFor="requestedTags" className="text-gray-300 text-lg">
                                    Desired Tags <span className="text-yellow-400">*</span>
                                </Label>
                                <Input
                                    id="requestedTags"
                                    type="text"
                                    value={requestedTags}
                                    onChange={(e) => setRequestedTags(e.target.value)}
                                    placeholder="e.g., Producer, Vocalist, DJ, Songwriter"
                                    className="mt-2 bg-black/20 border-white/10 text-white focus:border-yellow-400 text-base p-3"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Separate multiple tags with commas.</p>
                            </div>
                            <div>
                                <Label htmlFor="additionalInfo" className="text-gray-300 text-lg">
                                    Additional Information (Optional)
                                </Label>
                                <Textarea
                                    id="additionalInfo"
                                    value={additionalInfo}
                                    onChange={(e) => setAdditionalInfo(e.target.value)}
                                    placeholder="Tell us more about your work, provide links to your portfolio, or explain why you need these tags."
                                    className="mt-2 bg-black/20 border-white/10 text-white focus:border-yellow-400 min-h-[120px] text-base p-3"
                                />
                                <p className="text-xs text-gray-500 mt-1">This can help speed up the review process.</p>
                            </div>
                            <div className="pt-2">
                                <Button type="submit" className="w-full golden-gradient text-black font-bold text-lg py-3 hover:opacity-90" disabled={isLoading || !user}>
                                    {isLoading ? (
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    ) : (
                                        <Send className="mr-2 h-5 w-5" />
                                    )}
                                    {user ? 'Submit Request' : 'Login to Request Tags'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                    <CardFooter className="flex flex-col items-start text-sm text-gray-400 pt-6">
                        <div className="flex items-center mb-2">
                            <Info className="w-4 h-4 mr-2 text-yellow-400" />
                            <p><span className="font-semibold text-gray-300">Review Process:</span> Our team will review your request. You'll be notified of the outcome.</p>
                        </div>
                        <p>Becoming a verified creator helps others discover your work and expertise on CRFM.</p>
                    </CardFooter>
                </Card>
            </motion.div>
        );
    };

    export default RequestCreatorTagsTab;
