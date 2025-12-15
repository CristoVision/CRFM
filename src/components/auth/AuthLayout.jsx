import React from 'react';
    import { motion } from 'framer-motion';

    const AuthLayout = ({ children, title, subtitle }) => {
      return (
        <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4 font-montserrat">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 text-center"
          >
            <img 
              src="https://bcrjrlafzqudmdzbcruz.supabase.co/storage/v1/object/public/logo//crfm-logo-gold.gif"
              alt="CRFM Animated Logo"
              className="h-[110px] md:h-[130px] w-auto mx-auto mb-3"
            />
            <h1 className="text-3xl md:text-4xl font-bold golden-text mb-1">
              {title || "CRFM Streaming"}
            </h1>
            <p className="text-sm md:text-base text-gray-300 max-w-md mx-auto">
              {subtitle || "Welcome to CRFMinistry – Stream, Create, and Connect."}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-md"
          >
            <div className="glass-effect-light rounded-xl p-6 md:p-8 shadow-2xl border border-yellow-400/20">
              {children}
            </div>
          </motion.div>
          <footer className="mt-8 text-center">
            <p className="text-xs text-gray-500">
              &copy; {new Date().getFullYear()} CRFMinistry.com. All rights reserved.
            </p>
          </footer>
        </div>
      );
    };

    export default AuthLayout;
