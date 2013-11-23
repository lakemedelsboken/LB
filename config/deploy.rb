#cap production deploy

set :application, 'lb'
set :repo_url, 'https://github.com/lakemedelsboken/LB.git'

# ask :branch, proc { `git rev-parse --abbrev-ref HEAD`.chomp }

set :deploy_to, '/var/www/lb'
set :scm, :git
set :branch, 'master'

# set :format, :pretty
# set :log_level, :debug
# set :pty, true

# set :linked_files, %w{config/database.yml}
# set :linked_dirs, %w{bin log tmp/pids tmp/cache tmp/sockets vendor/bundle public/system}

# set :default_env, { path: "/opt/ruby/bin:$PATH" }
set :keep_releases, 3
#set :pass, fetch(:pass, '')

namespace :deploy do

  desc 'Restart application'
  task :restart do
    on roles(:web), in: :sequence, wait: 5 do
      # Your restart mechanism here, for example:
      # execute :touch, release_path.join('tmp/restart.txt')
      #within release_path do
        execute "rm -rf #{release_path}/fass/www/products"
        execute "mkdir -p #{release_path}/fass/www/"
        execute "mkdir -p #{shared_path}/fass/www/products"
        execute "ln -nfs #{shared_path}/fass/www/products #{release_path}/fass/www/"

        ask(:secretSettingsPassword, "")
        
        execute "mkdir -p #{shared_path}/settings"
        execute "rm -f #{shared_path}/settings/*"
        execute "cp  #{release_path}/settings/* #{shared_path}/settings/"

        execute "rm -rf #{release_path}/settings"

        execute "ln -nfs #{shared_path}/settings #{release_path}/"
        execute "cd #{shared_path}/settings && make decrypt_conf_pass PASS=#{fetch(:secretSettingsPassword)}"

        execute "pm2 kill"
        execute "cd /var/www/lb/current/servers/ && pm2 start pm2_#{fetch(:stage)}.json &"
        #end
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

  after :finishing, 'deploy:cleanup'

end

