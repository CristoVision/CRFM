import React from 'react';
    import { Link } from 'react-router-dom';
    import { Button } from '@/components/ui/button';
    import { AlertTriangle } from 'lucide-react';

    function NotFoundPage() {
      return (
        <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center px-4 gradient-bg">
          <AlertTriangle className="w-24 h-24 text-yellow-400 mb-8 animate-pulse" />
          <h1 className="text-6xl font-bold text-white mb-4">404</h1>
          <h2 className="text-3xl font-semibold golden-text mb-6">Page Not Found</h2>
          <p className="text-lg text-gray-300 mb-8 max-w-md">
            Oops! The page you're looking for doesn't seem to exist. It might have been moved, deleted, or maybe you just mistyped the URL.
          </p>
          <Button asChild className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity text-lg px-8 py-6">
            <Link to="/">Go Back to Home</Link>
          </Button>
        </div>
      );
    }

    export default NotFoundPage;
