import { useState, useEffect } from 'react';
import { useAuthStore, Company } from '../../store/authStore';
import { adminApi, AdminUser } from '../../services/api';
import { companyApi } from '../../services/companyApi';
import RegisterForm from '../../components/auth/RegisterForm';

// ユーザー一覧の型定義
interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  companyId?: string | null;
}

// 編集用ユーザーの型定義
interface EditUserData {
  name?: string;
  email?: string;
  password?: string;
  role?: 'ADMIN' | 'EMPLOYEE';
  companyId?: string;
}

const UserManagementPage = () => {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editData, setEditData] = useState<EditUserData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const { token, user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // ユーザー一覧を取得する関数
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await adminApi.getUsers();
      if (response.status === 'success') {
        // APIレスポンスのユーザーデータをUserListItem型に変換
        // データが存在するか確認し、存在しない場合は空の配列を使用
        const userData = response.data || [];
        console.log('User data from API:', userData); // デバッグ用ログ
        
        if (Array.isArray(userData)) {
          const userList: UserListItem[] = userData.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            companyId: user.companyId
          }));
          setUsers(userList);
        } else {
          console.error('User data is not an array:', userData);
          setError('ユーザーデータの形式が不正です');
        }
      } else {
        setError('ユーザーデータの取得に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントマウント時にユーザー一覧を取得
  useEffect(() => {
    // TEMP-DEBUG-F: アカウント登録フロー確認用（後で削除）
    console.log('[TEMP-DEBUG-F] [アカウント登録] ステップ3: ユーザー管理画面への遷移成功 - ユーザーID:', currentUser?.id);
    fetchUsers();
  }, []);

  // 日付をフォーマットする関数
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // 企業一覧を取得する関数
  const fetchCompanies = async () => {
    // スーパー管理者でない場合は何もしない
    if (!isSuperAdmin) {
      console.log('スーパー管理者以外は企業一覧を取得できません');
      return;
    }
    
    setIsLoadingCompanies(true);
    try {
      const response = await companyApi.getCompanies();
      if (response.status === 'success') {
        setCompanies(response.data);
      }
    } catch (error) {
      console.error('企業一覧の取得に失敗しました:', error);
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  // ユーザー編集を開始する関数
  const handleEditClick = (user: UserListItem) => {
    setSelectedUser(user);
    setEditData({
      name: user.name,
      email: user.email,
      role: user.role as 'ADMIN' | 'EMPLOYEE',
      companyId: user.companyId || ''
    });
    setShowEditForm(true);
    
    // スーパー管理者の場合のみ企業一覧を取得
    if (isSuperAdmin) {
      fetchCompanies();
    }
  };

  // ユーザー削除を開始する関数
  const handleDeleteClick = (user: UserListItem) => {
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  // ユーザー編集をキャンセルする関数
  const handleEditCancel = () => {
    setSelectedUser(null);
    setEditData({});
    setShowEditForm(false);
  };

  // ユーザー削除をキャンセルする関数
  const handleDeleteCancel = () => {
    setSelectedUser(null);
    setShowDeleteConfirm(false);
  };

  // ユーザー編集を保存する関数
  const handleEditSave = async () => {
    if (!selectedUser) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await adminApi.updateUser(selectedUser.id, editData);
      setShowEditForm(false);
      setSelectedUser(null);
      setEditData({});
      // ユーザー一覧を再取得
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新中にエラーが発生しました');
      console.error('Error updating user:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ユーザー削除を実行する関数
  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await adminApi.deleteUser(selectedUser.id);
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      // ユーザー一覧を再取得
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除中にエラーが発生しました');
      console.error('Error deleting user:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ユーザー登録が完了したときの処理
  const handleRegisterSuccess = () => {
    // TEMP-DEBUG-F: アカウント登録フロー確認用（後で削除）
    console.log('[TEMP-DEBUG-F] [アカウント登録] ステップ7: アカウント登録プロセス完了');
    
    setShowRegisterForm(false);
    // ユーザー一覧を再取得
    fetchUsers();
  };

  // 入力フィールドの変更を処理する関数
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ユーザー管理</h1>
        <button
          onClick={() => {
            // TEMP-DEBUG-F: アカウント登録フロー確認用（後で削除）
            if (!showRegisterForm) {
              console.log('[TEMP-DEBUG-F] [アカウント登録] ステップ4: 新規ユーザー登録フォーム表示 - 管理者ID:', currentUser?.id);
            }
            setShowRegisterForm(!showRegisterForm);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          {showRegisterForm ? 'キャンセル' : '新規ユーザー登録'}
        </button>
      </div>

      {showRegisterForm && (
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-4">新規ユーザー登録</h2>
          <RegisterForm onSuccess={handleRegisterSuccess} isAdminForm={true} />
        </div>
      )}

      {showEditForm && selectedUser && (
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-4">ユーザー編集: {selectedUser.name}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">名前</label>
              <input
                type="text"
                id="name"
                name="name"
                value={editData.name || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">メールアドレス</label>
              <input
                type="email"
                id="email"
                name="email"
                value={editData.email || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">パスワード（変更する場合のみ）</label>
              <input
                type="password"
                id="password"
                name="password"
                value={editData.password || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">ロール</label>
              <select
                id="role"
                name="role"
                value={editData.role || ''}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="EMPLOYEE">一般</option>
                <option value="ADMIN">管理者</option>
              </select>
            </div>
            
            {/* スーパー管理者の場合のみ企業選択ドロップダウンを表示 */}
            {isSuperAdmin && (
              <div>
                <label htmlFor="companyId" className="block text-sm font-medium text-gray-700">所属企業</label>
                <select
                  id="companyId"
                  name="companyId"
                  value={editData.companyId || ''}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={isLoadingCompanies}
                >
                  <option value="">-- 企業を選択 --</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                {isLoadingCompanies && (
                  <p className="text-sm text-gray-500 mt-1">企業情報を読み込み中...</p>
                )}
              </div>
            )}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={handleEditCancel}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                disabled={isSubmitting}
              >
                キャンセル
              </button>
              <button
                onClick={handleEditSave}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && selectedUser && (
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-4">ユーザー削除の確認</h2>
          <p className="mb-4">
            ユーザー「{selectedUser.name}」を削除してもよろしいですか？この操作は元に戻せません。
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleDeleteCancel}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? '削除中...' : '削除'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-medium">ユーザー一覧</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <p>読み込み中...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            <p>{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    名前
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    メールアドレス
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ロール
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    登録日
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    アクション
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'ADMIN' 
                          ? 'bg-purple-100 text-purple-800' 
                          : user.role === 'SUPER_ADMIN'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role === 'ADMIN' 
                          ? '管理者' 
                          : user.role === 'SUPER_ADMIN'
                            ? 'スーパー管理者'
                            : '一般'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleEditClick(user)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        disabled={currentUser?.id === user.id}
                      >
                        編集
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(user)}
                        className="text-red-600 hover:text-red-900"
                        disabled={currentUser?.id === user.id}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagementPage;
