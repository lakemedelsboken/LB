lock '3.7.2'

set :application, 'lb'
set :repo_url, 'https://github.com/lakemedelsboken/LB.git'

# Default branch is :master
ask :branch, `git rev-parse --abbrev-ref HEAD`.chomp

# Default deploy_to directory is /var/www/my_app_name
# set :deploy_to, '/var/www/lb'

# Default value for :scm is :git
# set :scm, :git

# Default value for :format is :pretty
# set :format, :pretty

# Default value for :log_level is :debug
# set :log_level, :debug

# Default value for :pty is false
# set :pty, true

# Default value for :linked_files is []
# set :linked_files, fetch(:linked_files, []).push('config/database.yml', 'config/secrets.yml')

# Default value for linked_dirs is []
# set :linked_dirs, fetch(:linked_dirs, []).push('log', 'tmp/pids', 'tmp/cache', 'tmp/sockets', 'vendor/bundle', 'public/system')

# Default value for default_env is {}
# set :default_env, { path: "/opt/ruby/bin:$PATH" }

# Default value for keep_releases is 5
set :keep_releases, 2

namespace :deploy do

  after 'deploy:publishing', 'deploy:restart'

  desc 'Restart application'
  task :restart do
    on roles(:web), in: :sequence, wait: 5 do
      # Your restart mechanism here, for example:
      # execute :touch, release_path.join('tmp/restart.txt')
      #within release_path do

      #Create symlinks for fass products
      execute "rm -rf #{release_path}/fass/www/products"
      execute "mkdir -p #{release_path}/fass/www/"
      execute "mkdir -p #{shared_path}/fass/www/products"
      execute "ln -nfs #{shared_path}/fass/www/products #{release_path}/fass/www/"

      #Create symlink for foundUpdates.json
      execute "mkdir -p #{shared_path}/fass/shared"
      execute "cp -n #{release_path}/fass/shared/foundUpdates.json #{shared_path}/fass/shared/foundUpdates.json"
      execute "rm -rf #{release_path}/fass/shared"
      execute "ln -nfs #{shared_path}/fass/shared #{release_path}/fass/"

      #rebuild node-xml module
      execute "cd #{release_path}/npl/ && npm install xml-stream"

      #rebuild scrypt module
      execute "cd #{release_path}/servers/cms/node_modules/scrypt/ && sudo npm install"

      ask(:secretSettingsPassword, nil, echo: false)

      #if
      execute "mkdir -p #{shared_path}/settings"
      execute "rm -f #{shared_path}/settings/*"
      execute "cp  #{release_path}/settings/* #{shared_path}/settings/"

      execute "rm -rf #{release_path}/settings"

      execute "ln -nfs #{shared_path}/settings #{release_path}/"
      execute "cd #{shared_path}/settings && make decrypt_conf_pass PASS=#{fetch(:secretSettingsPassword)}"

      #Decrypt synonym database
      execute "cd #{release_path}/servers/cms/search/synonyms && make decrypt_conf_pass PASS=#{fetch(:secretSettingsPassword)}"

      #Make current release a working git repository

    execute "rm -rf /var/www/lb/gittemp/"
    execute "git clone -b #{fetch(:branch)} --single-branch --depth 1 ssh://git@github.com/lakemedelsboken/LB.git /var/www/lb/gittemp"
    execute "mv /var/www/lb/gittemp/.git /var/www/lb/current/.git"
    execute "rm -rf /var/www/lb/gittemp/"


      execute "pm2 kill"

      execute "cd /var/www/lb/current/servers/ && export NODE_ENV=production && pm2 start ./pm2_#{fetch(:stage)}.json"
    end
  end

  after :restart, :clear_cache do
    on roles(:web), in: :groups, limit: 3, wait: 10 do
      # Here we can do anything such as:
      # within release_path do
      #   execute :rake, 'cache:clear'
      # end
    end
  end

end
