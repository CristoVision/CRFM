import React, { useState, useRef } from 'react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { useAuth } from '@/contexts/AuthContext';
    import { Mail, Lock, User, Image as ImageIcon, Loader2, UserPlus, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
    import { toast } from '@/components/ui/use-toast';
    import { useLanguage } from '@/contexts/LanguageContext';

    const PasswordRequirement = ({ met, text }) => (
        <li className={`flex items-center text-xs ${met ? 'text-green-400' : 'text-gray-400'}`}>
          {met ? <CheckCircle className="w-3 h-3 mr-1.5 flex-shrink-0" /> : <AlertCircle className="w-3 h-3 mr-1.5 flex-shrink-0 text-yellow-500" />}
          {text}
        </li>
    );
      

	    const SignUpForm = ({ onSwitchToLogin }) => {
	      const [email, setEmail] = useState('');
	      const [password, setPassword] = useState('');
	      const [showPassword, setShowPassword] = useState(false);
	      const [confirmPassword, setConfirmPassword] = useState('');
	      const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	      const [firstName, setFirstName] = useState('');
	      const [middleName, setMiddleName] = useState('');
	      const [lastName, setLastName] = useState('');
	      const [secondLastName, setSecondLastName] = useState('');
	      const [avatarFile, setAvatarFile] = useState(null);
	      const [avatarPreview, setAvatarPreview] = useState(null);
      const { register, loading } = useAuth();
      const avatarInputRef = useRef(null);
      const { t } = useLanguage();
      
      const [passwordValidation, setPasswordValidation] = useState({
        minLength: false,
        lowercase: false,
        uppercase: false,
        number: false,
        symbol: false,
      });

      const validatePassword = (newPassword) => {
        setPasswordValidation({
          minLength: newPassword.length >= 8,
          lowercase: /[a-z]/.test(newPassword),
          uppercase: /[A-Z]/.test(newPassword),
          number: /[0-9]/.test(newPassword),
          symbol: /[^A-Za-z0-9]/.test(newPassword),
        });
      };

      const handlePasswordChange = (e) => {
        const newPassword = e.target.value;
        setPassword(newPassword);
        validatePassword(newPassword);
      };


      const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 2 * 1024 * 1024) { // 2MB limit
            toast({ title: t('auth.signup.imageTooLargeTitle'), description: t('auth.signup.imageTooLargeDescription'), variant: "destructive" });
            return;
          }
          setAvatarFile(file);
          const reader = new FileReader();
          reader.onloadend = () => {
            setAvatarPreview(reader.result);
          };
          reader.readAsDataURL(file);
        }
      };

      const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
          toast({ title: t('auth.signup.passwordsMismatch'), variant: "destructive" });
          return;
        }
        const allValid = Object.values(passwordValidation).every(Boolean);
        if (!allValid) {
            toast({ title: t('auth.signup.passwordRequirementsTitle'), description: t('auth.signup.passwordRequirementsDescription'), variant: "destructive" });
            return;
        }

	        const nameParts = {
	          first_name: firstName,
	          middle_name: middleName,
	          last_name: lastName,
	          second_last_name: secondLastName,
	        };
	        const { success, error } = await register(email, password, nameParts, avatarFile);
	        if (success) {
	          toast({ title: t('auth.signup.successTitle'), description: t('auth.signup.successDescription'), className: "bg-green-600 text-white" });
	        } else if (error) {
	          toast({ title: t('auth.signup.errorTitle'), description: error, variant: "destructive" });
	        }
	      };

      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center space-y-2">
            <Label htmlFor="avatar-upload-signup" className="text-gray-300 text-sm cursor-pointer">
              {t('auth.signup.avatarLabel')}
            </Label>
            <Avatar className="w-20 h-20 border-2 border-yellow-400/50 ring-2 ring-yellow-400/30 ring-offset-2 ring-offset-card">
              <AvatarImage src={avatarPreview} alt={t('auth.signup.avatarPreviewAlt')} />
              <AvatarFallback className="bg-black/30 text-yellow-400">
                <ImageIcon className="w-8 h-8" />
              </AvatarFallback>
            </Avatar>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              className="text-xs bg-black/20 border-white/10 text-gray-300 hover:border-yellow-400 hover:text-yellow-300"
              onClick={() => avatarInputRef.current?.click()}
              disabled={loading}
            >
              {t('auth.signup.uploadImage')}
            </Button>
            <Input
              id="avatar-upload-signup"
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarChange}
              className="hidden"
              accept="image/png, image/jpeg, image/gif"
              disabled={loading}
            />
          </div>

	          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
	            <div className="space-y-1 relative">
	              <Label htmlFor="firstName-signup" className="text-gray-300 text-xs">{t('auth.signup.firstNameLabel')}</Label>
	              <User className="absolute left-3 top-8 transform -translate-y-1/2 w-4 h-4 text-yellow-400/70" />
	              <Input
	                id="firstName-signup"
	                type="text"
	                value={firstName}
	                onChange={(e) => setFirstName(e.target.value)}
	                className="bg-black/20 border-white/10 text-white placeholder-gray-500 pl-10 focus:border-yellow-400 h-11"
	                placeholder={t('auth.signup.firstNamePlaceholder')}
	                required
	                disabled={loading}
	              />
	            </div>
	            <div className="space-y-1 relative">
	              <Label htmlFor="middleName-signup" className="text-gray-300 text-xs">{t('auth.signup.middleNameLabel')}</Label>
	              <User className="absolute left-3 top-8 transform -translate-y-1/2 w-4 h-4 text-yellow-400/70" />
	              <Input
	                id="middleName-signup"
	                type="text"
	                value={middleName}
	                onChange={(e) => setMiddleName(e.target.value)}
	                className="bg-black/20 border-white/10 text-white placeholder-gray-500 pl-10 focus:border-yellow-400 h-11"
	                placeholder={t('auth.signup.middleNamePlaceholder')}
	                disabled={loading}
	              />
	            </div>
	            <div className="space-y-1 relative">
	              <Label htmlFor="lastName-signup" className="text-gray-300 text-xs">{t('auth.signup.lastNameLabel')}</Label>
	              <User className="absolute left-3 top-8 transform -translate-y-1/2 w-4 h-4 text-yellow-400/70" />
	              <Input
	                id="lastName-signup"
	                type="text"
	                value={lastName}
	                onChange={(e) => setLastName(e.target.value)}
	                className="bg-black/20 border-white/10 text-white placeholder-gray-500 pl-10 focus:border-yellow-400 h-11"
	                placeholder={t('auth.signup.lastNamePlaceholder')}
	                required
	                disabled={loading}
	              />
	            </div>
	            <div className="space-y-1 relative">
	              <Label htmlFor="secondLastName-signup" className="text-gray-300 text-xs">{t('auth.signup.secondLastNameLabel')}</Label>
	              <User className="absolute left-3 top-8 transform -translate-y-1/2 w-4 h-4 text-yellow-400/70" />
	              <Input
	                id="secondLastName-signup"
	                type="text"
	                value={secondLastName}
	                onChange={(e) => setSecondLastName(e.target.value)}
	                className="bg-black/20 border-white/10 text-white placeholder-gray-500 pl-10 focus:border-yellow-400 h-11"
	                placeholder={t('auth.signup.secondLastNamePlaceholder')}
	                disabled={loading}
	              />
	            </div>
	          </div>
          
          <div className="space-y-1 relative">
            <Label htmlFor="email-signup" className="text-gray-300 text-xs">{t('auth.signup.emailLabel')}</Label>
            <Mail className="absolute left-3 top-8 transform -translate-y-1/2 w-4 h-4 text-yellow-400/70" />
            <Input
              id="email-signup"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 pl-10 focus:border-yellow-400 h-11"
              placeholder={t('auth.signup.emailPlaceholder')}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1 relative">
            <Label htmlFor="password-signup" className="text-gray-300 text-xs">{t('auth.signup.passwordLabel')}</Label>
            <Lock className="absolute left-3 top-8 transform -translate-y-1/2 w-4 h-4 text-yellow-400/70" />
            <Input
              id="password-signup"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={handlePasswordChange}
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 pl-10 pr-10 focus:border-yellow-400 h-11"
              placeholder={t('auth.signup.passwordPlaceholder')}
              required
              disabled={loading}
            />
            <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 transform -translate-y-1/2 text-yellow-400/70 hover:text-yellow-300 focus:outline-none"
                aria-label={showPassword ? t('auth.signup.hidePassword') : t('auth.signup.showPassword')}
                disabled={loading}
            >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          
          <ul className="mt-1 space-y-0.5 px-1">
                <PasswordRequirement met={passwordValidation.minLength} text={t('auth.passwordRules.minLength')} />
                <PasswordRequirement met={passwordValidation.lowercase} text={t('auth.passwordRules.lowercase')} />
                <PasswordRequirement met={passwordValidation.uppercase} text={t('auth.passwordRules.uppercase')} />
                <PasswordRequirement met={passwordValidation.number} text={t('auth.passwordRules.number')} />
                <PasswordRequirement met={passwordValidation.symbol} text={t('auth.passwordRules.symbol')} />
                <li className="text-xs text-gray-500 mt-1">{t('auth.passwordRules.breachNotice')}</li>
          </ul>


          <div className="space-y-1 relative">
            <Label htmlFor="confirmPassword-signup" className="text-gray-300 text-xs">{t('auth.signup.confirmPasswordLabel')}</Label>
            <Lock className="absolute left-3 top-8 transform -translate-y-1/2 w-4 h-4 text-yellow-400/70" />
            <Input
              id="confirmPassword-signup"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 pl-10 pr-10 focus:border-yellow-400 h-11"
              placeholder={t('auth.signup.confirmPasswordPlaceholder')}
              required
              disabled={loading}
            />
            <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-8 transform -translate-y-1/2 text-yellow-400/70 hover:text-yellow-300 focus:outline-none"
                aria-label={showConfirmPassword ? t('auth.signup.hidePassword') : t('auth.signup.showPassword')}
                disabled={loading}
            >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Button
            type="submit"
            disabled={loading || !Object.values(passwordValidation).every(Boolean) || password !== confirmPassword}
            className="w-full golden-gradient text-black font-semibold hover:opacity-90 transition-opacity text-base py-3 mt-2 proximity-glow-button h-11"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <UserPlus className="w-5 h-5 mr-2" />}
            {t('auth.signup.createAccount')}
          </Button>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-400">
              {t('auth.signup.haveAccountPrompt')}{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-semibold text-yellow-400 hover:text-yellow-300 hover:underline"
                disabled={loading}
              >
                {t('auth.signup.signInLink')}
              </button>
            </p>
          </div>
        </form>
      );
    };

    export default SignUpForm;
