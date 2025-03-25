import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useAuth } from '../../hooks/useAuth';
import { ProfileForm, PasswordChangeForm } from '../../components/profile';

const ProfilePage: React.FC = () => {
  const { user, error } = useAuthStore();
  const { fetchCurrentUser } = useAuth();
  
  // ページロード時にユーザー情報を取得
  useEffect(() => {
    fetchCurrentUser();
  }, []);
  
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">アカウント設定</h1>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <div className="space-y-6">
        <ProfileForm />
        <PasswordChangeForm />
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Slack連携</h2>
          <p className="text-sm text-gray-500 mb-4">
            Slackと連携すると、Slackから勤怠打刻ができるようになります
          </p>
          <button 
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            onClick={() => {/* Slack連携処理を追加 */}}
          >
            Slackと連携する
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
