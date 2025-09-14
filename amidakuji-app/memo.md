デプロイ
gcloud app deploy

scss監視
npm run scss

サーバー上の状態を確認する
gcloud app logs tail -s default

クラウド側にCORS設定を行う
gcloud storage buckets update gs://amidakuji-app-native-bucket --cors-file=./cors-config.json
