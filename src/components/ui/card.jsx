import React from 'react';
    import { cn } from '@/lib/utils';
    import { motion } from 'framer-motion';

    const cardVariants = {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
      hover: { 
        scale: 1.03,
        boxShadow: "0px 10px 30px -5px rgba(255, 215, 0, 0.2), 0px 5px 15px -5px rgba(255, 215, 0, 0.1)",
        transition: { duration: 0.2 }
      }
    };
    
    const Card = React.forwardRef(({ className, children, onClick, ...props }, ref) => (
      <motion.div
        ref={ref}
        variants={cardVariants}
        initial="initial"
        animate="animate"
        whileHover="hover"
        className={cn(
          "rounded-xl border bg-card text-card-foreground shadow-sm glass-effect overflow-hidden",
          onClick ? "cursor-pointer" : "",
          className
        )}
        onClick={onClick}
        {...props}
      >
        {children}
      </motion.div>
    ));
    Card.displayName = "Card";

    const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 p-6", className)}
        {...props} />
    ));
    CardHeader.displayName = "CardHeader";

    const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
      <h3
        ref={ref}
        className={cn("text-2xl font-semibold leading-none tracking-tight golden-text", className)}
        {...props} />
    ));
    CardTitle.displayName = "CardTitle";

    const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
      <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props} />
    ));
    CardDescription.displayName = "CardDescription";

    const CardContent = React.forwardRef(({ className, ...props }, ref) => (
      <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
    ));
    CardContent.displayName = "CardContent";

    const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn("flex items-center p-6 pt-0", className)}
        {...props} />
    ));
    CardFooter.displayName = "CardFooter";

    export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
